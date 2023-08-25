const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools') :
  require('../../layers/lambda-powertools/lambda-powertools');

const { TextractClient, GetDocumentTextDetectionCommand } = require('@aws-sdk/client-textract');
const textractClient = new TextractClient();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client();
const { PDFDocument, rgb, StandardFonts, numberToString } = require('pdf-lib');

exports.handler = initializePowertools(async (event) => {
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
  const jobId = snsMessage.JobId;
  const inputBucketName = snsMessage.DocumentLocation.S3Bucket;
  const objectKey = snsMessage.DocumentLocation.S3ObjectName;

  const s3Object = await exports.getObject(inputBucketName, objectKey);

  const pdfStream = await exports.streamToBuffer(s3Object.Body);
  const pdfDoc = await PDFDocument.load(pdfStream);

  const pages = pdfDoc.getPages();

  const pageWidth = pages[0].getWidth();
  const pageHeight = pages[0].getHeight();

  const text = await this.getText(jobId);
  const textBlocks = this.parseTextBlocks(text, pageHeight);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const block of textBlocks) {
    const text = block.Text;
    const left = block.Left;
    const top = block.Top;
    const width = block.Width;
    const height = block.Height;
    const fontSize = block.Size;

    console.log(`Text: "${text}", Left: ${left}, Top: ${top}, Width: ${width}, Height: ${height}`);


    const textX = left * pageWidth;
    const textY = (1 - top) * pageHeight - 2; // Adjust for inverted Y-axis

    pages[0].drawText(text, {
      x: textX,
      y: textY,
      font,
      size: fontSize,
      color: rgb(1, 0, 0)
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  await exports.saveModifiedObject(objectKey, modifiedPdfBytes);

  return 'hello world';
});

exports.getText = async (jobId) => {
  const command = new GetDocumentTextDetectionCommand({
    JobId: jobId
  });

  return await textractClient.send(command);
};

exports.getObject = async (bucketName, objectKey) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey
  });

  return await s3Client.send(command);
};

exports.saveModifiedObject = async (objectKey, fileContent) => {
  const command = new PutObjectCommand({
    Bucket: process.env.OUTPUT_BUCKET_NAME,
    Key: `ocrd-${objectKey}`,
    Body: fileContent
  });

  await s3Client.send(command);
};

exports.parseTextBlocks = (textractResponse, pageHeight) => {
  const textBlocks = textractResponse.Blocks.filter((block) => block.BlockType === 'WORD');

  return textBlocks.map((block) => {
    const { Text, Geometry } = block;
    const { Left, Top, Width, Height } = Geometry.BoundingBox;

    // Normalize the coordinates to values between 0 and 1
    // const normalizedLeft = Left;
    // const normalizedTop = 1 - Top - Height;
    // const normalizedWidth = Width;
    // const normalizedHeight = Height;

    return {
      Text,
      Left,
      Top,
      Width,
      Height,
      Size: Height * pageHeight * 1.5
    };
  });
};

exports.streamToBuffer = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

exports.calculateFontSize = (text, maxWidth, maxHeight, font) => {
  let fontSize = 12; // Starting font size

  while (fontSize > 1) {
    const width = font.widthOfTextAtSize(text, fontSize);
    const height = font.heightAtSize(fontSize);

    if (width <= maxWidth && height <= maxHeight) {
      break;
    }

    fontSize -= 1;
  }

  return fontSize;
};