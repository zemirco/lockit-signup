
var path = require('path');
var events = require('events');
var util = require('util');
var express = require('express');
var uuid = require('node-uuid');
var ms = require('ms');
var moment = require('moment');
var Mail = require('lockit-sendmail');



/**
 * Internal helper functions
 */
function join(view) {
  return path.join(__dirname, 'views', view);
}



/**
 * Signup constructor function.
 *
 * @constructor
 * @param {Object} config
 * @param {Object} adapter
 */
var Signup = module.exports = function(config, adapter) {
  if (!(this instanceof Signup)) return new Signup(config, adapter);
  events.EventEmitter.call(this);

  this.config = config;
  this.adapter = adapter;

  var route = config.signup.route || '/signup';
  if (config.rest) route = '/rest' + route;

  var router = express.Router();
  router.get(route, this.getSignup.bind(this));
  router.post(route, this.postSignup.bind(this));
  router.get(route + '/resend-verification', this.getSignupResend.bind(this));
  router.post(route + '/resend-verification', this.postSignupResend.bind(this));
  router.get(route + '/:token', this.getSignupToken.bind(this));
  this.router = router;
};

util.inherits(Signup, events.EventEmitter);



/**
 * GET /signup.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
Signup.prototype.getSignup = function(req, res, next) {
  // do not handle the route when REST is active
  if (this.config.rest) return next();

  // custom or built-in view
  var view = this.config.signup.views.signup || join('get-signup');

  res.render(view, {
    title: 'Sign up',
    basedir: req.app.get('views')
  });
};



/**
 * POST /signup.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
Signup.prototype.postSignup = function(req, res, next) {
  var config = this.config;
  var adapter = this.adapter;
  var that = this;

  var name = req.body.name;
  var email = req.body.email;
  var password = req.body.password;

  var error = null;
  // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
  var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

  // check for valid inputs
  if (!name || !email || !password) {
    error = 'All fields are required';
  } else if (name !== encodeURIComponent(name)) {
    error = 'Username may not contain any non-url-safe characters';
  } else if (name !== name.toLowerCase()) {
    error = 'Username must be lowercase';
  } else if (!name.charAt(0).match(/[a-z]/)) {
    error = 'Username has to start with a lowercase letter (a-z)';
  } else if (!email.match(EMAIL_REGEXP)) {
    error = 'Email is invalid';
  }

  // custom or built-in view
  var errorView = config.signup.views.signup || join('get-signup');

  if (error) {
    // send only JSON when REST is active
    if (config.rest) return res.json(403, {error: error});

    // render template with error message
    res.status(403);
    res.render(errorView, {
      title: 'Sign up',
      error: error,
      basedir: req.app.get('views')
    });
    return;
  }

  // check for duplicate name
  adapter.find('name', name, function(err, user) {
    if (err) return next(err);

    if (user) {
      error = 'Username already taken';
      // send only JSON when REST is active
      if (config.rest) return res.json(403, {error: error});

      // render template with error message
      res.status(403);
      res.render(errorView, {
        title: 'Sign up',
        error: error,
        basedir: req.app.get('views')
      });
      return;
    }

    // check for duplicate email - send reminder when duplicate email is found
    adapter.find('email', email, function(err, user) {
      if (err) return next(err);

      // custom or built-in view
      var successView = config.signup.views.signedUp || join('post-signup');

      if (user) {
        // send already registered email
        var mail = new Mail(config);
        mail.taken(user.name, user.email, function(err, result) {
          if (err) return next(err);

          // send only JSON when REST is active
          if (config.rest) return res.send(204);

          res.render(successView, {
            title: 'Sign up - Email sent',
            basedir: req.app.get('views')
          });
        });

        return;
      }

      // looks like everything is fine

      // save new user to db
      adapter.save(name, email, password, function(err, user) {
        if (err) return next(err);

        // send email with link for address verification
        var mail = new Mail(config);
        mail.signup(user.name, user.email, user.signupToken, function(err, result) {
          if (err) return next(err);

          // emit event
          that.emit('signup::post', user);

          // send only JSON when REST is active
          if (config.rest) return res.send(204);

          res.render(successView, {
            title: 'Sign up - Email sent',
            basedir: req.app.get('views')
          });
        });

      });

    });

  });
};



/**
 * GET /signup/resend-verification.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
Signup.prototype.getSignupResend = function(req, res, next) {
  // do not handle the route when REST is active
  if (this.config.rest) return next();

  // custom or built-in view
  var view = this.config.signup.views.resend || join('resend-verification');

  res.render(view, {
    title: 'Resend verification email',
    basedir: req.app.get('views')
  });
};



/**
 * POST /signup/resend-verification.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
Signup.prototype.postSignupResend = function(req, res, next) {
  var config = this.config;
  var adapter = this.adapter;

  var email = req.body.email;

  var error = null;
  // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
  var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

  if (!email || !email.match(EMAIL_REGEXP)) {
    error = 'Email is invalid';
  }

  if (error) {
    // send only JSON when REST is active
    if (config.rest) return res.json(403, {error: error});

    // custom or built-in view
    var errorView = config.signup.views.resend || join('resend-verification');

    // render template with error message
    res.status(403);
    res.render(errorView, {
      title: 'Resend verification email',
      error: error,
      basedir: req.app.get('views')
    });
    return;
  }

  // check for user with given email address
  adapter.find('email', email, function(err, user) {
    if (err) return next(err);

    // custom or built-in view
    var successView = config.signup.views.signedUp || join('post-signup');

    // no user with that email address exists -> just render success message
    // or email address is already verified -> user has to use password reset function
    if (!user || user.emailVerified) {
      // send only JSON when REST is active
      if (config.rest) return res.send(204);

      res.render(successView, {
        title: 'Sign up - Email sent',
        basedir: req.app.get('views')
      });
      return;
    }

    // we have an existing user with provided email address

    // create new signup token
    var token = uuid.v4();

    // save token on user object
    user.signupToken = token;

    // set new sign up token expiration date
    var timespan = ms(config.signup.tokenExpiration);
    user.signupTokenExpires = moment().add(timespan, 'ms').toDate();

    // save updated user to db
    adapter.update(user, function(err, user) {
      if (err) return next(err);

      // send sign up email
      var mail = new Mail(config);
      mail.resend(user.name, email, token, function(err, result) {
        if (err) return next(err);

        // send only JSON when REST is active
        if (config.rest) return res.send(204);

        res.render(successView, {
          title: 'Sign up - Email sent',
          basedir: req.app.get('views')
        });
      });

    });

  });
};



/**
 * GET /signup/:token.
 *
 * Route is at the end so it does not
 * catch :token === 'resend-verification'.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
Signup.prototype.getSignupToken = function(req, res, next) {
  var config = this.config;
  var adapter = this.adapter;
  var that = this;

  var token = req.params.token;

  // verify format of token
  var re = new RegExp('[0-9a-f]{22}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'i');

  // if format is wrong no need to query the database
  if (!re.test(token)) return next();

  // find user by token
  adapter.find('signupToken', token, function(err, user) {
    if (err) return next(err);

    // no user found -> forward to error handling middleware
    if (!user) return next();

    // check if token has expired
    if (new Date(user.signupTokenExpires) < new Date()) {

      // delete old token
      delete user.signupToken;

      // save updated user to db
      adapter.update(user, function(err, user) {
        if (err) return next(err);

        // send only JSON when REST is active
        if (config.rest) return res.json(403, {error: 'token expired'});

        // custom or built-in view
        var expiredView = config.signup.views.linkExpired || join('link-expired');

        // render template to allow resending verification email
        res.render(expiredView, {
          title: 'Sign up - Email verification link expired',
          basedir: req.app.get('views')
        });

      });

      return;
    }

    // everything seems to be fine

    // set user verification values
    user.emailVerificationTimestamp = new Date();
    user.emailVerified = true;

    // remove token and token expiration date from user object
    delete user.signupToken;
    delete user.signupTokenExpires;

    // save user with updated values to db
    adapter.update(user, function(err, user) {
      if (err) return next(err);

      // emit 'signup' event
      that.emit('signup', user, res);

      if (config.signup.handleResponse) {

        // send only JSON when REST is active
        if (config.rest) return res.send(204);

        // custom or built-in view
        var view = config.signup.views.verified || join('mail-verification-success');

        // render email verification success view
        res.render(view, {
          title: 'Sign up success',
          basedir: req.app.get('views')
        });

      }

    });

  });
};
