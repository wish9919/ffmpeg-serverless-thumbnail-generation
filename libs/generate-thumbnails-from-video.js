const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { spawnSync, spawn } = require("child_process");
const doesFileExist = require("./does-file-exist.js");
const generateTmpFilePath = require("./generate-tmp-file-path.js");

const ffprobePath = "/opt/bin/ffprobe";
const ffmpegPath = "/opt/bin/ffmpeg";

const THUMBNAIL_TARGET_BUCKET = process.env.S3_BUCKET;

module.exports = async (tmpVideoPath, captureInterval, videoFileName) => {
  const times = generateTimesToCapture(tmpVideoPath, captureInterval);

  for (const [index, time] of Object.entries(times)) {
    const tmpThumbnailPath = await createImageFromVideo(tmpVideoPath, time);
    if (doesFileExist(tmpThumbnailPath)) {
      const nameOfImageToCreate = generateNameOfImageToUpload(
        videoFileName,
        index
      );
      await uploadFileToS3(tmpThumbnailPath, nameOfImageToCreate);
    }
  }
};

const generateTimesToCapture = (tmpVideoPath, captureInterval) => {
  const videoDuration = getVideoDuration(tmpVideoPath);
  console.info(`Video Duration: `, videoDuration);

  // Calculate the number of thumbnails to generate based on the time interval
  const thumbnailCount = Math.ceil(videoDuration / captureInterval);
  console.info(`Generating thumbnail count: `, thumbnailCount);

  const times = new Array(thumbnailCount)
    .fill(0)
    .map((_, i) => i * captureInterval);

  console.info("Times for generate thumbnails", JSON.stringify(times, null, 2));
  return times;
};

const getVideoDuration = (tmpVideoPath) => {
  const ffprobe = spawnSync(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    tmpVideoPath,
  ]);

  return Math.floor(ffprobe.stdout.toString());
};

const createImageFromVideo = (videoPath, time) => {
  const thumbnailPath = generateThumbnailPath(time);
  console.info("Thumbnail Path: ", thumbnailPath);
  const ffmpegParams = createFfmpegParams(videoPath, thumbnailPath, time);

  const result = spawnSync(ffmpegPath, ffmpegParams);

  if (result.status !== 0) {
    throw new Error(`Command failed: ${result.stderr.toString()}`);
  }
  return thumbnailPath;
};

const generateThumbnailPath = (time) => {
  const thumbnailPathTemplate = "/tmp/thumbnail-{HASH}-{num}.jpg";
  const uniqueThumbnailPath = generateTmpFilePath(thumbnailPathTemplate);
  const thumbnailPathWithNumber = uniqueThumbnailPath.replace("{num}", time);

  return thumbnailPathWithNumber;
};

const createFfmpegParams = (videoPath, thumbnailPath, time) => {
  return [
    "-ss",
    time,
    "-i",
    videoPath,
    "-vf",
    "thumbnail,scale=160:90",
    "-vframes",
    1,
    thumbnailPath,
  ];
};

const generateNameOfImageToUpload = (videoFileName, i) => {
  const strippedExtension = videoFileName.replace(".mp4", "");
  return `${strippedExtension}-${i}.jpg`;
};

const uploadFileToS3 = async (thumbnailPath, thumbnailKey) => {
  const contents = fs.createReadStream(thumbnailPath);

  const command = new PutObjectCommand({
    Bucket: THUMBNAIL_TARGET_BUCKET,
    Key: thumbnailKey,
    Body: contents,
    ContentType: "image/jpg",
  });

  const s3 = new S3Client({ region: process.env.REGION });
  await s3.send(command);
};
