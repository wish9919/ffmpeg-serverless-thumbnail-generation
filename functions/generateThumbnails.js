const fs = require("fs");
const path = require("path");

const doesFileExist = require("../libs/does-file-exist.js");
const downloadVideoToTmpDirectory = require("../libs/download-video-to-tmp-directory.js");
const generateThunbnailsFromVideo = require("../libs/generate-thumbnails-from-video.js");

const CAPTURE_INTERVAL = 5;

/**
 * @type {import('@types/aws-lambda').S3Handler}
 */
module.exports.handler = async (event) => {
  console.info("Event recieved", JSON.stringify(event));

  const bucket = event.Records[0].s3.bucket.name;
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key).replace(
    /\+/g,
    " "
  );

  try {
    await wipeTmpDirectory();
    const tmpVideoPath = await downloadVideoToTmpDirectory(bucket, objectKey);
    console.log(`Video downloaded to ${tmpVideoPath}`);

    if (doesFileExist(tmpVideoPath)) {
      await generateThunbnailsFromVideo(
        tmpVideoPath,
        CAPTURE_INTERVAL,
        objectKey
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const wipeTmpDirectory = async () => {
  const files = await fs.promises.readdir("/tmp/");
  const filePaths = files.map((file) => path.join("/tmp/", file));
  await Promise.all(filePaths.map((file) => fs.promises.unlink(file)));
};
