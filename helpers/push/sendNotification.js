const admin = require('../../config/firebaseAdmin');

const chunkTokens = (tokens, size = 500) => {
  const chunks = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size));
  }
  return chunks;
};

const sendNotification = async ({ tokens = [], notification = {}, data = {} }) => {
  if (!tokens.length) {
    return {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };
  }

  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  const tokenChunks = chunkTokens(tokens);

  for (const chunk of tokenChunks) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification,
      data,
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((res, index) => {
      if (!res.success) {
        const errorCode = res.error?.code;
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(chunk[index]);
        }
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
};

module.exports = sendNotification;
