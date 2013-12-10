
var path = require('path');
var uuid = require('node-uuid');
var ms = require('ms');
var moment = require('moment');
var debug = require('debug')('lockit-signup');

module.exports = function(app, config) {
  
  var adapter = require('lockit-' + config.db + '-adapter')(config);
  var sendmail = require('lockit-sendmail')(config);

  // set up the default route
  var route = config.signupRoute || '/signup';

  // GET /signup
  app.get(route, function(req, res) {
    debug('GET %s', route);
    res.render(path.join(__dirname, 'views', 'get-signup'), {
      title: 'Sign up'
    });
  });

  // POST /signup
  app.post(route, function(req, response) {
    debug('POST %s: %j', route, req.body);

    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var verification = req.body.verification;

    var error = null;
    // regexp from https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L4
    var EMAIL_REGEXP = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;

    // check for valid inputs
    if (!username || !email || !password || !verification) {
      error = 'All fields are required';
    } else if (username !== encodeURIComponent(username)) {
      error = 'Username may not contain any non-url-safe characters';
    } else if (!email.match(EMAIL_REGEXP)) {
      error = 'Email is invalid';
    } else if (password !== verification) {
      error = 'Passwords don\'t match';
    }

    if (error) {
      debug('POST error: %s', error);
      // render template with error message
      response.status(403);
      response.render(path.join(__dirname, 'views', 'get-signup'), {
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
        // render template with error message
        response.status(403);
        response.render(path.join(__dirname, 'views', 'get-signup'), {
          title: 'Sign up',
          error: 'Username already taken'
        });
        return;
      }
      
      // check for duplicate email - send reminder when duplicate email is found
      adapter.find('email', email, function(err, user) {
        if (err) console.log(err);
        
        if (user) {
          debug('email already in db');
          
          // send already registered email
          var Email = new sendmail('emailSignupTaken');
          Email.send(user.username, user.email, function(err, res) {
            if (err) console.log(err);
            response.render(path.join(__dirname, 'views', 'post-signup'), {
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
          var Email = new sendmail('emailSignup');
          Email.send(user.username, user.email, user.signupToken, function(err, res) {
            if (err) console.log(err);
            response.render(path.join(__dirname, 'views', 'post-signup'), {
              title: 'Sign up - Email sent'
            });
          });

        });
        
      });
      
    });
    
  });
  
  // GET /signup/resend-verification
  app.get(route + '/resend-verification', function(req, res) {
    debug('GET %s/resend-verification', route);
    res.render(path.join(__dirname, 'views', 'resend-verification'), {
      title: 'Resend verification email'
    });
  });
  
  // POST /signup/resend-verification
  app.post(route + '/resend-verification', function(req, response) {
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
      // render template with error message
      response.status(403);
      response.render(path.join(__dirname, 'views', 'resend-verification'), {
        title: 'Resend verification email',
        error: error
      });
      return;
    }
    
    // check for user with given email address
    adapter.find('email', email, function(err, user) {
      if (err) console.log(err);

      // no user with that email address exists -> just render success message
      // or email address is already verified -> user has to use password reset function
      if (!user || user.emailVerified) {
        debug('no user found or email is not verified');

        response.status(200);
        response.render(path.join(__dirname, 'views', 'post-signup'), {
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
      var timespan = ms(config.signupTokenExpiration);
      user.signupTokenExpires = moment().add(timespan, 'ms').toDate();
      
      // save updated user to db
      adapter.update(user, function(err, res) {
        if (err) console.log(err);

        // send sign up email
        var Email = new sendmail('emailResendVerification');
        Email.send(user.username, email, token, function(err, res) {
          if (err) console.log(err);
          response.render(path.join(__dirname, 'views', 'post-signup'), {
            title: 'Sign up - Email sent'
          });
        });

      });

    });
    
  });

  // route is at the end so it does not catch :token === 'resend-verification'
  // GET /signup/:token
  app.get(route + '/:token', function(req, response, next) {
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

          // render template to allow resending verification email
          response.render(path.join(__dirname, 'views', 'link-expired'), {
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
      adapter.update(user, function(err, res) {
        if (err) console.log(err);

        // render email verification success view
        response.render(path.join(__dirname, 'views', 'mail-verification-success'), {
          title: 'Sign up success'
        });

      });

    });

  });
  
};