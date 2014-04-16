
var path = require('path');
var events = require('events');
var util = require('util');
var express = require('express');
var uuid = require('node-uuid');
var ms = require('ms');
var moment = require('moment');

/**
 * Internal helper functions
 */

function join(view) {
  return path.join(__dirname, 'views', view);
}

/**
 * Let's get serious
 */

var Signup = module.exports = function(config, adapter) {

  if (!(this instanceof Signup)) return new Signup(config, adapter);

  var Mail = require('lockit-sendmail')(config);

  // call super constructor function
  events.EventEmitter.call(this);

  var that = this;

  // shorten config
  var cfg = config.signup;

  // set default route
  var route = cfg.route || '/signup';

  // change URLs if REST is active
  if (config.rest) route = '/rest' + route;

  /**
   * Routes
   */

  var router = express.Router();
  router.get(route, getSignup);
  router.post(route, postSignup);
  router.get(route + '/resend-verification', getSignupResend);
  router.post(route + '/resend-verification', postSignupResend);
  router.get(route + '/:token', getSignupToken);
  this.router = router;

  /**
   * Route handlers
   */

  // GET /signup
  function getSignup(req, res, next) {
    // do not handle the route when REST is active
    if (config.rest) return next();

    // custom or built-in view
    var view = cfg.views.signup || join('get-signup');

    res.render(view, {
      title: 'Sign up',
      basedir: req.app.get('views')
    });
  }

  // POST /signup
  function postSignup(req, response, next) {

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
    var errorView = cfg.views.signup || join('get-signup');

    if (error) {
      // send only JSON when REST is active
      if (config.rest) return response.json(403, {error: error});

      // render template with error message
      response.status(403);
      response.render(errorView, {
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
        if (config.rest) return response.json(403, {error: error});

        // render template with error message
        response.status(403);
        response.render(errorView, {
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
        var successView = cfg.views.signedUp || join('post-signup');

        if (user) {
          // send already registered email
          var mail = new Mail('emailSignupTaken');
          mail.send(user.name, user.email, function(err, res) {
            if (err) return next(err);

            // send only JSON when REST is active
            if (config.rest) return response.send(204);

            response.render(successView, {
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
          var mail = new Mail('emailSignup');
          mail.send(user.name, user.email, user.signupToken, function(err, res) {
            if (err) return next(err);

            // emit event
            that.emit('signup::post', user);

            // send only JSON when REST is active
            if (config.rest) return response.send(204);

            response.render(successView, {
              title: 'Sign up - Email sent',
              basedir: req.app.get('views')
            });
          });

        });

      });

    });
  }

  // GET /signup/resend-verification
  function getSignupResend(req, res, next) {
    // do not handle the route when REST is active
    if (config.rest) return next();

    // custom or built-in view
    var view = cfg.views.resend || join('resend-verification');

    res.render(view, {
      title: 'Resend verification email',
      basedir: req.app.get('views')
    });
  }

  // POST /signup/resend-verification
  function postSignupResend(req, response, next) {
    var email = req.body.email;

    var error = null;
    // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
    var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

    if (!email || !email.match(EMAIL_REGEXP)) {
      error = 'Email is invalid';
    }

    if (error) {
      // send only JSON when REST is active
      if (config.rest) return response.json(403, {error: error});

      // custom or built-in view
      var errorView = cfg.views.resend || join('resend-verification');

      // render template with error message
      response.status(403);
      response.render(errorView, {
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
      var successView = cfg.views.signedUp || join('post-signup');

      // no user with that email address exists -> just render success message
      // or email address is already verified -> user has to use password reset function
      if (!user || user.emailVerified) {
        // send only JSON when REST is active
        if (config.rest) return response.send(204);

        response.render(successView, {
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
      var timespan = ms(cfg.tokenExpiration);
      user.signupTokenExpires = moment().add(timespan, 'ms').toDate();

      // save updated user to db
      adapter.update(user, function(err, res) {
        if (err) return next(err);

        // send sign up email
        var mail = new Mail('emailResendVerification');
        mail.send(user.name, email, token, function(err, res) {
          if (err) return next(err);

          // send only JSON when REST is active
          if (config.rest) return response.send(204);

          response.render(successView, {
            title: 'Sign up - Email sent',
            basedir: req.app.get('views')
          });
        });

      });

    });
  }

  // route is at the end so it does not catch :token === 'resend-verification'
  // GET /signup/:token
  function getSignupToken(req, response, next) {
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
        adapter.update(user, function(err, res) {
          if (err) return next(err);

          // send only JSON when REST is active
          if (config.rest) return response.json(403, {error: 'token expired'});

          // custom or built-in view
          var expiredView = cfg.views.linkExpired || join('link-expired');

          // render template to allow resending verification email
          response.render(expiredView, {
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
        that.emit('signup', user, response);

        if (cfg.handleResponse) {

          // send only JSON when REST is active
          if (config.rest) return response.send(204);

          // custom or built-in view
          var view = cfg.views.verified || join('mail-verification-success');

          // render email verification success view
          response.render(view, {
            title: 'Sign up success',
            basedir: req.app.get('views')
          });

        }

      });

    });
  }

};

util.inherits(Signup, events.EventEmitter);
