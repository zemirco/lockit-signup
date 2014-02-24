
var path = require('path');
var uuid = require('node-uuid');
var ms = require('ms');
var moment = require('moment');
var utls = require('lockit-utils');
var debug = require('debug')('lockit-signup');

// require event emitter
var events = require('events');
var util = require('util');

/**
 * Internal helper functions
 */

function join(view) {
  return path.join(__dirname, 'views', view);
}

/**
 * Let's get serious
 */

var Signup = module.exports = function(app, config) {

  if (!(this instanceof Signup)) {
    return new Signup(app, config);
  }

  var that = this;

  var db = utls.getDatabase(config);

  var adapter = require(db.adapter)(config);
  var Mail = require('lockit-sendmail')(config);

  var cfg = config.signup;

  // set up the default route
  var route = cfg.route || '/signup';

  // change URLs if REST is active
  if (config.rest) route = '/rest' + route;

  /**
   * Routes
   */

  app.get(route, getSignup);
  app.post(route, postSignup);
  app.get(route + '/resend-verification', getSignupResend);
  app.post(route + '/resend-verification', postSignupResend);
  app.get(route + '/:token', getSignupToken);

  /**
   * Route handlers
   */

  // GET /signup
  function getSignup(req, res, next) {
    debug('GET %s', route);

    // do not handle the route when REST is active
    if (config.rest) return next();

    // custom or built-in view
    var view = cfg.views.signup || join('get-signup');

    res.render(view, {
      title: 'Sign up'
    });
  }

  // POST /signup
  function postSignup(req, response) {
    debug('POST %s: %j', route, req.body);

    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;

    var error = null;
    // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
    var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

    // check for valid inputs
    if (!username || !email || !password) {
      error = 'All fields are required';
    } else if (username !== encodeURIComponent(username)) {
      error = 'Username may not contain any non-url-safe characters';
    } else if (!email.match(EMAIL_REGEXP)) {
      error = 'Email is invalid';
    }

    // custom or built-in view
    var errorView = cfg.views.signup || join('get-signup');

    if (error) {
      debug('POST error: %s', error);

      // send only JSON when REST is active
      if (config.rest) return response.json(403, {error: error});

      // render template with error message
      response.status(403);
      response.render(errorView, {
        title: 'Sign up',
        error: error
      });
      return;
    }

    // check for duplicate username
    adapter.find('username', username, function(err, user) {
      if (err) console.log(err);

      if (user) {
        debug('username already taken');
        error = 'Username already taken';
        // send only JSON when REST is active
        if (config.rest) return response.json(403, {error: error});

        // render template with error message
        response.status(403);
        response.render(errorView, {
          title: 'Sign up',
          error: error
        });
        return;
      }

      // check for duplicate email - send reminder when duplicate email is found
      adapter.find('email', email, function(err, user) {
        if (err) console.log(err);

        // custom or built-in view
        var successView = cfg.views.signedUp || join('post-signup');

        if (user) {
          debug('email already in db');

          // send already registered email
          var mail = new Mail('emailSignupTaken');
          mail.send(user.username, user.email, function(err, res) {
            if (err) console.log(err);

            // send only JSON when REST is active
            if (config.rest) return response.send(200);

            response.render(successView, {
              title: 'Sign up - Email sent'
            });
          });

          return;
        }

        // looks like everything is fine

        // save new user to db
        adapter.save(username, email, password, function(err, user) {
          if (err) console.log(err);

          // send email with link for address verification
          var mail = new Mail('emailSignup');
          mail.send(user.username, user.email, user.signupToken, function(err, res) {
            if (err) console.log(err);

            // send only JSON when REST is active
            if (config.rest) return response.send(200);

            response.render(successView, {
              title: 'Sign up - Email sent'
            });
          });

        });

      });

    });
  }

  // GET /signup/resend-verification  
  function getSignupResend(req, res, next) {
    debug('GET %s/resend-verification', route);

    // do not handle the route when REST is active
    if (config.rest) return next();

    // custom or built-in view
    var view = cfg.views.resend || join('resend-verification');

    res.render(view, {
      title: 'Resend verification email'
    });
  }

  // POST /signup/resend-verification  
  function postSignupResend(req, response) {
    debug('POST %s/resend-verification: %j', route, req.body);
    var email = req.body.email;

    var error = null;
    // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
    var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

    if (!email || !email.match(EMAIL_REGEXP)) {
      error = 'Email is invalid';
    }

    if (error) {
      debug('POST error: %s', error);

      // send only JSON when REST is active
      if (config.rest) return response.json(403, {error: error});

      // custom or built-in view
      var errorView = cfg.views.resend || join('resend-verification');

      // render template with error message
      response.status(403);
      response.render(errorView, {
        title: 'Resend verification email',
        error: error
      });
      return;
    }

    // check for user with given email address
    adapter.find('email', email, function(err, user) {
      if (err) console.log(err);

      // custom or built-in view
      var successView = cfg.views.signedUp || join('post-signup');

      // no user with that email address exists -> just render success message
      // or email address is already verified -> user has to use password reset function
      if (!user || user.emailVerified) {
        debug('no user found or email is not verified');

        // send only JSON when REST is active
        if (config.rest) return response.send(200);

        response.status(200);
        response.render(successView, {
          title: 'Sign up - Email sent'
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
        if (err) console.log(err);

        // send sign up email
        var mail = new Mail('emailResendVerification');
        mail.send(user.username, email, token, function(err, res) {
          if (err) console.log(err);

          // send only JSON when REST is active
          if (config.rest) return response.send(200);

          response.render(successView, {
            title: 'Sign up - Email sent'
          });
        });

      });

    });
  }

  // route is at the end so it does not catch :token === 'resend-verification'
  // GET /signup/:token  
  function getSignupToken(req, response, next) {
    var token = req.params.token;
    debug('GET %s with token: %s', route, token);

    // verify format of token
    var re = new RegExp('[0-9a-f]{22}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'i');

    // if format is wrong no need to query the database
    if (!re.test(token)) return next();

    // find user by token
    adapter.find('signupToken', token, function(err, user) {
      if (err) console.log(err);

      // no user found -> forward to error handling middleware
      if (!user) return next();

      // check if token has expired
      if (new Date(user.signupTokenExpires) < new Date()) {
        debug('signup token has expired');

        // delete old token
        delete user.signupToken;

        // save updated user to db
        adapter.update(user, function(err, res) {
          if (err) console.log(err);

          // send only JSON when REST is active
          if (config.rest) return response.json(403, {error: 'token expired'});

          // custom or built-in view
          var expiredView = cfg.views.linkExpired || join('link-expired');

          // render template to allow resending verification email
          response.render(expiredView, {
            title: 'Sign up - Email verification link expired'
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
        if (err) console.log(err);

        // emit 'signup' event
        that.emit('signup', user, response);
        
        if (cfg.handleResponse) {
          
          // send only JSON when REST is active
          if (config.rest) return response.send(200);

          // custom or built-in view
          var view = cfg.views.verified || join('mail-verification-success');

          // render email verification success view
          response.render(view, {
            title: 'Sign up success'
          });
          
        }

      });

    });
  }

  events.EventEmitter.call(this);

};

util.inherits(Signup, events.EventEmitter);