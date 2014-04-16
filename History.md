
##### 1.0.0 - 2014-??-??

- requires Express 4.x
- makes use of `express.Router()`. No need to pass `app` around as argument.

  **Old**

  ```js
  var Signup = require('lockit-signup');

  var signup = new Signup(app, config, adapter);
  ```

  **New**

  ```js
  var Signup = require('lockit-signup');

  var signup = new Signup(config, adapter);
  app.use(signup.router);
  ```

- proper Error handling. All Errors are piped to next middleware.

  Old

  ```js
  if (err) console.log(err);
  ```

  New

  ```js
  if (err) return next(err);
  ```

  Make sure you have some sort of error handling middleware at the end of your
  routes (is included by default in Express 4.x apps if you use the `express-generator`).


##### 0.7.1 - 2014-04-14

- username (`name`) has to be lowercase and has to start with a letter

##### 0.7.0 - 2014-04-11

- `username` becomes `name`
