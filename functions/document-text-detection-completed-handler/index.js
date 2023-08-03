const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools') :
  require('../../layers/lambda-powertools/lambda-powertools');

exports.handler = initializePowertools(async (event) => {
  console.log('hello world');
  return 'hello world';
});