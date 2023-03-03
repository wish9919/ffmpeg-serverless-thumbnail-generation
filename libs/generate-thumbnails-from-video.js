const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { spawnSync } = require("child_process");
const doesFileExist = require("./does-file-exist.js");
const generateTmpFilePath = require("./generate-tmp-file-path.js");

const ffprobePath = "/opt/bin/ffprobe";
const ffmpegPath = "/opt/bin/ffmpeg";

const THUMBNAIL_TARGET_BUCKET = process.env.S3_BUCKET;

module.exports = async (tmpVideoPath, numberOfThumbnails, videoFileName) => {
  const randomTimes = generateRandomTimes(tmpVideoPath, numberOfThumbnails);

  for (const [index, randomTime] of Object.entries(randomTimes)) {
    const tmpThumbnailPath = await createImageFromVideo(
      tmpVideoPath,
      randomTime
    );

    if (doesFileExist(tmpThumbnailPath)) {
      const nameOfImageToCreate = generateNameOfImageToUpload(
        videoFileName,
        index
      );
      await uploadFileToS3(tmpThumbnailPath, nameOfImageToCreate);
    }
  }
};

const generateRandomTimes = (tmpVideoPath, numberOfTimesToGenerate) => {
  const timesInSeconds = [];
  const videoDuration = getVideoDuration(tmpVideoPath);

  for (let x = 0; x < numberOfTimesToGenerate; x++) {
    const randomNum = getRandomNumberNotInExistingList(
      timesInSeconds,
      videoDuration
    );

    if (randomNum >= 0) {
      timesInSeconds.push(randomNum);
    }
  }

  return timesInSeconds;
};

const getRandomNumberNotInExistingList = (existingList, maxValueOfNumber) => {
  for (let attemptNumber = 0; attemptNumber < 3; attemptNumber++) {
    const randomNum = getRandomNumber(maxValueOfNumber);

    if (!existingList.includes(randomNum)) {
      return randomNum;
    }
  }

  return -1;
};

const getRandomNumber = (upperLimit) => {
  return Math.floor(Math.random() * upperLimit);
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

const createImageFromVideo = (tmpVideoPath, targetSecond) => {
  const tmpThumbnailPath = generateThumbnailPath(targetSecond);
  const ffmpegParams = createFfmpegParams(
    tmpVideoPath,
    tmpThumbnailPath,
    targetSecond
  );
  spawnSync(ffmpegPath, ffmpegParams);

  return tmpThumbnailPath;
};

const generateThumbnailPath = (targetSecond) => {
  const tmpThumbnailPathTemplate = "/tmp/thumbnail-{HASH}-{num}.jpg";
  const uniqueThumbnailPath = generateTmpFilePath(tmpThumbnailPathTemplate);
  const thumbnailPathWithNumber = uniqueThumbnailPath.replace(
    "{num}",
    targetSecond
  );

  return thumbnailPathWithNumber;
};

const createFfmpegParams = (tmpVideoPath, tmpThumbnailPath, targetSecond) => {
  return [
    "-ss",
    targetSecond,
    "-i",
    tmpVideoPath,
    "-vf",
    "thumbnail,scale=16:9",
    "-vframes",
    1,
    tmpThumbnailPath,
  ];
};

const generateNameOfImageToUpload = (videoFileName, i) => {
  const strippedExtension = videoFileName.replace(".mp4", "");
  return `${strippedExtension}-${i}.jpg`;
};

const uploadFileToS3 = async (tmpThumbnailPath, nameOfImageToCreate) => {
  const contents = fs.createReadStream(tmpThumbnailPath);

  const command = new PutObjectCommand({
    Bucket: THUMBNAIL_TARGET_BUCKET,
    Key: nameOfImageToCreate,
    Body: contents,
    ContentType: "image/jpg",
  });

  const s3 = new S3Client({ region: process.env.REGION });
  await s3.send(command);
};
