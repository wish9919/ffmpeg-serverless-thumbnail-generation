const fs = require("fs");
const { spawnSync } = require("child_process");

const videoPath =
  "/Users/don/Desktop/thumbnail-generation/test/inputs/test-1.mp4";

const ffmpegPath = "/opt/homebrew/bin/ffmpeg";
const ffprobePath = "/opt/homebrew/bin/ffprobe";

const generateTimesToCapture = (tmpVideoPath, captureInterval) => {
  const videoDuration = getVideoDuration(tmpVideoPath);
  console.info(`Video Duration: `, videoDuration);

  // Calculate the number of thumbnails to generate based on the time interval
  const thumbnailCount = Math.ceil(videoDuration / captureInterval);
  console.info(`Generating thumbnail count: `, thumbnailCount);

  const times = new Array(thumbnailCount)
    .fill(0)
    .map((_, i) => i * captureInterval);

  console.info("Times for generate thumbnails: ", times.join(", "));
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

  if (ffprobe.status != 0) {
    return ffprobe.stderr.toString();
  }
  return Math.floor(ffprobe.stdout.toString());
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

const generateTmpFilePath = (filePathTemplate) => {
  const hash = getRandomString(10);
  const tmpFilePath = filePathTemplate.replace("{HASH}", hash);

  return tmpFilePath;
};

const getRandomString = (len) => {
  const charset =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = len; i > 0; --i) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }

  return result;
};

const generateThumbnailPath = (time) => {
  const thumbnailPathTemplate =
    "/Users/don/Desktop/thumbnail-generation/test/outputs/thumbnail-{HASH}-{num}.jpg";
  const uniqueThumbnailPath = generateTmpFilePath(thumbnailPathTemplate);
  const thumbnailPathWithNumber = uniqueThumbnailPath.replace("{num}", time);

  return thumbnailPathWithNumber;
};

const createImageFromVideo = (videoPath, time) => {
  const thumbnailPath = generateThumbnailPath(time);
  console.info("Thumbnail Path: ", thumbnailPath);
  const ffmpegParams = createFfmpegParams(videoPath, thumbnailPath, time);

  const result = spawnSync(ffmpegPath, ffmpegParams);

  if (result.status !== 0) {
    console.error(`Command failed: ${result.stderr.toString()}`);
  }
  return thumbnailPath;
};

const generateNameOfImageToUpload = (videoFileName, i) => {
  const strippedExtension = videoFileName.replace(".mp4", "");
  return `${strippedExtension}-${i}.jpg`;
};

const times = generateTimesToCapture(videoPath, 5);

const promise = async () => {
  for (const [index, time] of Object.entries(times)) {
    const tmpThumbnailPath = await createImageFromVideo(videoPath, time);
    if (doesFileExist(tmpThumbnailPath)) {
      const nameOfImageToCreate = generateNameOfImageToUpload(videoPath, index);

      console.log(nameOfImageToCreate);
      // await uploadFileToS3(tmpThumbnailPath, nameOfImageToCreate);
    }
  }
};

const doesFileExist = (filePath) => {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;

    if (fileSizeInBytes > 0) {
      console.log(`${filePath} exists!`); // Remove this once your proof-of-concept is working
      return true;
    } else {
      console.error(`${filePath} exists but is 0 bytes in size`);
      return false;
    }
  } else {
    console.error(`${filePath} does not exist`);
    return false;
  }
};

promise();
