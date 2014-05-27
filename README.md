# Lockit signup

[![Build Status](https://travis-ci.org/zemirco/lockit-signup.svg?branch=master)](https://travis-ci.org/zemirco/lockit-signup)
[![NPM version](https://badge.fury.io/js/lockit-signup.svg)](http://badge.fury.io/js/lockit-signup)
[![Dependency Status](https://david-dm.org/zemirco/lockit-signup.svg)](https://david-dm.org/zemirco/lockit-signup)

Sign up users to your Express app. The module is part of [Lockit](https://github.com/zemirco/lockit).

## Installation

`npm install lockit-signup`

```js
var Signup = require('lockit-signup');
var lockitUtils = require('lockit-utils');
var config = require('./config.js');

var db = lockitUtils.getDatabase(config);
var adapter = require(db.adapter)(config);

var app = express();

// express settings
// ...
// sessions are required - either cookie or some sort of db
app.use(cookieParser());
app.use(cookieSession({
  secret: 'this is my super secret string'
}));

// create new Signup instance
var signup = new Signup(config, adapter);

// use signup.router with your app
app.use(signup.router);
```

## Configuration

More about configuration at [lockit](https://github.com/zemirco/lockit).

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

MIT
