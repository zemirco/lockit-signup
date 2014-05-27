
##### 1.1.0 / 2014-05-27

- improve views by using Bootstrap conditional classes
- set `autocomplete="off"` for forms
- refactor code
- use updated `lockit-sendmail` module
- update dependencies

##### 1.0.0 / 2014-04-19

- requires Express 4.x
- makes use of `express.Router()`. No need to pass `app` around as argument.

  **old**

  ```js
  var Signup = require('lockit-signup');

  var signup = new Signup(app, config, adapter);
  ```

  **new**

  ```js
  var Signup = require('lockit-signup');

  var signup = new Signup(config, adapter);
  app.use(signup.router);
  ```

- proper Error handling. All Errors are piped to next middleware.

  **old**

  ```js
  if (err) console.log(err);
  ```

  **new**

  ```js
  if (err) return next(err);
  ```

  Make sure you have some sort of error handling middleware at the end of your
  routes (is included by default in Express 4.x apps if you use the `express-generator`).


##### 0.7.1 / 2014-04-14

- username (`name`) has to be lowercase and has to start with a letter

##### 0.7.0 / 2014-04-11

- `username` becomes `name`
