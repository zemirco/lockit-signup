# Lockit signup

[![Build Status](https://travis-ci.org/zeMirco/lockit-signup.png?branch=master)](https://travis-ci.org/zeMirco/lockit-signup) [![NPM version](https://badge.fury.io/js/lockit-signup.png)](http://badge.fury.io/js/lockit-signup)

Sign up users to your Express app. The module is part of [Lockit](https://github.com/zeMirco/lockit).

## Installation

`npm install lockit-signup`

```js
var config = require('./config.js');
var signup = require('lockit-signup');

var app = express();

// express settings
// ...

// sessions are required - either cookie or some sort of db
app.use(express.cookieParser('your secret here'));
app.use(express.cookieSession());
app.use(app.router);

// use middleware after router so it doesn't interfere with your own routes
signup(app, config);

// serve static files as last middleware
app.use(express.static(path.join(__dirname, 'public')));
```

## Configuration

More about configuration at [lockit](https://github.com/zeMirco/lockit).

## Features

 - validate inputs
 - hash password
 - validation link expiration
 - verify email address via unique tokens
 - prevent duplicate email/username sign up
 - resend verification email

## Routes included

 - `GET /signup`
 - `POST /signup`
 - `GET /signup/:token`
 - `GET /signup/resend-verification`
 - `POST /signup/resend-verification`
 
## REST API

If you've set `exports.rest = true` in your `config.js` the module behaves as follows.

 - all routes have `/rest` prepended
 - `GET /rest/signup` is `next()`ed and you can catch `/signup` on the client
 - `POST /rest/signup` stays the same but only sends JSON
 - `GET /rest/signup/:token` sends JSON
 - `GET /rest/signup/resend-verification` is `next()`ed and you can catch `/signup/resend-verification` on the client
 - `POST /rest/signup/resend-verification` sends JSON
 
## Test

`grunt`

## License

Copyright (C) 2013 [Mirco Zeiss](mailto: mirco.zeiss@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.