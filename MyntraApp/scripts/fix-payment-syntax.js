const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../server/src/controllers/paymentController.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the broken renderCheckoutPage check
const badBlock = `  if (!order) {
      return res.status(404).send('<h2>Order Not Found</h2>');
    }

    if (req.user && order.userId && order.userId !== req.user.id) {
      return res.status(403).send('<h2>Access Denied: You cannot view another customer\\'s checkout page.</h2>');
    }
    return res.status(404).send(\`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Order #\${orderId} Not Found</h2>
        <p>Please return to the app and select your order.</p>
      </body>
      </html>
    \`);
  }`;

const fixedBlock = `  if (!order) {
    return res.status(404).send(\`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Order #\${orderId} Not Found</h2>
        <p>Please return to the app and select your order.</p>
      </body>
      </html>
    \`);
  }

  if (req.user && order.userId && order.userId !== req.user.id) {
    return res.status(403).send(\`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Access Denied</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Access Denied</h2>
        <p>You cannot access another customer's checkout page.</p>
      </body>
      </html>
    \`);
  }`;

content = content.replace(badBlock, fixedBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed renderCheckoutPage in paymentController.js');
