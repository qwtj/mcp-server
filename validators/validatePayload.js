// validators/validatePayload.js
// Express middleware for input validation using express-validator

const { validationResult, checkSchema } = require('express-validator');

// Example schema: customize per route
const exampleSchema = {
  name: {
    in: ['body'],
    isString: true,
    trim: true,
    notEmpty: true,
    errorMessage: 'Name is required and must be a string.'
  },
  email: {
    in: ['body'],
    isEmail: true,
    normalizeEmail: true,
    errorMessage: 'Valid email required.'
  }
};

function validatePayload(schema = exampleSchema) {
  return [
    checkSchema(schema),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    }
  ];
}

module.exports = { validatePayload, exampleSchema };
