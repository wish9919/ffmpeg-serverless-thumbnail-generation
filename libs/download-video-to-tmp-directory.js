const fs = require("fs");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const generateTempFilePath = require("./generate-tmp-file-path.js");

const s3Client = new S3Client({ region: process.env.REGION });

module.exports = async (triggerBucketName, videoFileName) => {
  const downloadResult = await getVideoFromS3(triggerBucketName, videoFileName);
  const videoAsBuffer = downloadResult.Body;

  const tmpVideoFilePath = await saveFileToTmpDirectory(videoAsBuffer);
  return tmpVideoFilePath;
};

const getVideoFromS3 = async (bucketName, key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const res = await s3Client.send(command);
  return res;
};

const saveFileToTmpDirectory = async (fileAsBuffer) => {
  const tmpVideoPathTemplate = "/tmp/vid-{HASH}.mp4";
  const tmpVideoFilePath = generateTempFilePath(tmpVideoPathTemplate);
  await fs.promises.writeFile(tmpVideoFilePath, fileAsBuffer, "base64");

  return tmpVideoFilePath;
};
