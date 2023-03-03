"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuid } = require("uuid");
const mime = require("mime-types");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({ region: process.env.REGION });

const BUCKET_NAME = process.env.S3_BUCKET;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandlerV2}
 */
module.exports.handler = async (event) => {
  console.info("Event recieved", JSON.stringify(event));
  const body = JSON.parse(event.body);

  const fileName = body.fileName;
  const assetId = uuid();
  const contentType = mime.lookup(fileName);

  if (!fileName && !contentType) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Bad Request",
      }),
    };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${assetId}/${fileName}`,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(
        { presignedUrl, assetId, fileName, mimeType: contentType },
        null,
        2
      ),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
