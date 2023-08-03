const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools') :
  require('../../layers/lambda-powertools/lambda-powertools');

const { TextractClient, GetDocumentTextDetectionCommand, PutObjectCommand } = require('@aws-sdk/client-textract');
const textractClient = new TextractClient();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client();
const { PDFDocument, rgb } = require('pdf-lib');

exports.handler = initializePowertools(async (event) => {
  const snsMessage = JSON.parse(event.Records[0].Sns.Message);
  const { jobId, bucketName, objectKey } = snsMessage;

  const s3Object = await exports.getObject(bucketName, objectKey);
  const text = await this.getText(jobId);
  const textBlocks = this.parseTextBlocks(text);

  const pdfDoc = await PDFDocument.load(s3Object.Body);
  const [page] = pdfDoc.getPages();

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const textLayer = pdfDoc.createLayer('text');
  const textFont = await pdfDoc.embedFont(PDFDocument.Font.Helvetica);

  for (const { Text, Left, Top, Width, Height } of textBlocks) {
    const textX = Left * pageWidth;
    const textY = Top * pageHeight;
    const textWidth = Width * pageWidth;
    const textHeight = Height * pageHeight;

    const textOptions = {
      font: textFont,
      size: 12,
      color: rgb(0, 0, 0)
    };

    textLayer.drawText(Text, {
      x: textX,
      y: textY,
      width: textWidth,
      height: textHeight,
      ...textOptions
    });
  }

  page.addLayer(textLayer);

  const modifiedPdfBytes = await pdfDoc.save();
  exports.saveModifiedObject(bucketName, objectKey, modifiedPdfBytes);

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

exports.saveModifiedObject = async (bucketName, objectKey, fileContent) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `ocrd-${objectKey}`,
    Body: fileContent
  });

  await s3Client.send(command);
};

exports.parseTextBlocks = (textractResponse) => {
  const textBlocks = textractResponse.filter((block) => block.BlockType === 'WORD');

  return textBlocks.map((block) => {
    const { Text, Geometry } = block;
    const { Left, Top, Width, Height } = Geometry.BoundingBox;

    // Normalize the coordinates to values between 0 and 1
    const normalizedLeft = Left;
    const normalizedTop = 1 - Top - Height;
    const normalizedWidth = Width;
    const normalizedHeight = Height;

    return {
      Text, Left: normalizedLeft,
      Top: normalizedTop,
      Width: normalizedWidth,
      Height: normalizedHeight
    };
  });
};