# sign up middleware for lockit

[![Build Status](https://travis-ci.org/zeMirco/lockit-signup.png?branch=master)](https://travis-ci.org/zeMirco/lockit-signup)

not ready yet .. come back later

## Installation

`npm install lockit-signup`

```js
var signup = require('lockit-signup');
var app = express();

signup(app);
```

## What do I get?

 - `GET /signup`
 - `POST /signup`
 - `GET /signup/:token`
 - `GET /signup/resend-verification`
 - `POST /signup/resend-verification`

## Test

Requires a CouchDB instance at ...

Needs the design views in CouchDB from lockit-couchdb-adapter -> run init.js

## License