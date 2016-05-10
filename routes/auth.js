var express = require('express');
var router = express.Router();

var request = require('request');
var qs = require('querystring');
var User = require('../models/user');
var jwt = require('jwt-simple');

//  auth.js
//  /auth  router

router.post('/login', (req, res) => {
  User.authenticate(req.body, (err, token) => {
    if(err) return res.status(400).send(err);

    res.send({ token: token });
  });
});

router.post('/signup', (req, res) => {
  User.register(req.body, (err, user) => {
    if(err) return res.status(400).send(err);

    var token = user.makeToken();
    res.send({ token: token });
  });
});

router.post('/github', (req, res) => {
  var accessTokenUrl = 'https://github.com/login/oauth/access_token';
  var userApiUrl = 'https://api.github.com/user';



  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    redirect_uri: req.body.redirectUri,
    client_secret: process.env.GITHUB_SECRET
  };
console.log('github params:', params);
  // use code to request access token
  request.get({ url: accessTokenUrl, qs: params }, (err, response, body) => {
    if(err) return res.status(400).send(err);

    var accessToken = qs.parse(body);
    var headers = { 'User-Agent': 'satellizer' };

    //  use access token to request user profile
    request.get({ url: userApiUrl, qs: accessToken, headers: headers, json: true }, (err, response, profile) => {
      if(err) return res.status(400).send(err);

      User.findOne({ github: profile.id }, (err, existingUser) => {
        if(err) return res.status(400).send(err);

        if(existingUser) {
          var token = existingUser.makeToken();
          res.send({ token: token });

        } else {
          var user = new User();
          user.github = profile.id;
          console.log('new user:', user);
          user.save((err, savedUser) => {
            var token = savedUser.makeToken();
            res.send({ token: token });
          });
        }
      });
    });
  });
});
/*
 |--------------------------------------------------------------------------
 | Login with Twitter
 |--------------------------------------------------------------------------
 */
router.post('/twitter', function(req, res) {
  var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
  var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
  var profileUrl = 'https://api.twitter.com/1.1/users/show.json?screen_name=';

  // Part 1 of 2: Initial request from Satellizer.
  if (!req.body.oauth_token || !req.body.oauth_verifier) {
    var requestTokenOauth = {
      consumer_key: process.env.TWITTER_KEY,
      consumer_secret: process.env.TWITTER_SECRET,
      callback: req.body.redirectUri
    };

    // Step 1. Obtain request token for the authorization popup.
    request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
      var oauthToken = qs.parse(body);

      // Step 2. Send OAuth token back to open the authorization screen.
      res.send(oauthToken);
    });
  } else {
    // Part 2 of 2: Second request after Authorize app is clicked.
    var accessTokenOauth = {
      consumer_key: process.env.TWITTER_KEY,
      consumer_secret: process.env.TWITTER_SECRET,
      token: req.body.oauth_token,
      verifier: req.body.oauth_verifier
    };

    // Step 3. Exchange oauth token and oauth verifier for access token.
    request.post({ url: accessTokenUrl, oauth: accessTokenOauth }, function(err, response, accessToken) {

      accessToken = qs.parse(accessToken);

      var profileOauth = {
        consumer_key: process.env.TWITTER_KEY,
        consumer_secret: process.env.TWITTER_SECRET,
        oauth_token: accessToken.oauth_token
      };

      // Step 4. Retrieve profile information about the current user.
      request.get({
        url: profileUrl + accessToken.screen_name,
        oauth: profileOauth,
        json: true
      }, function(err, response, profile) {

        // Step 5a. Link user accounts.
        if (req.header('Authorization')) {
          User.findOne({ twitter: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a Twitter account that belongs to you' });
            }

            var token = req.header('Authorization').split(' ')[1];
            var payload = jwt.decode(token, process.env.TOKEN_SECRET);

            User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }

              user.twitter = profile.id;
            //   user.displayName = user.displayName || profile.name;
            //   user.picture = user.picture || profile.profile_image_url.replace('_normal', '');
              user.save(function(err) {
                res.send({ token: user.makeToken() });
              });
            });
          });
        } else {
          // Step 5b. Create a new user account or return an existing one.
          User.findOne({ twitter: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.send({ token: existingUser.makeToken() });
            }

            var user = new User();
            user.twitter = profile.id;
            // user.displayName = profile.name;
            // user.picture = profile.profile_image_url.replace('_normal', '');
            user.save(function() {
              res.send({ token: user.makeToken() });
            });
          });
        }
      });
    });
  }
});

//facebook login
router.post('/facebook', (req, res) => {
    console.log("CODE ", req.body.code);

  var fields = ['id', 'email', 'first_name', 'last_name', 'link', 'name'];
  var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
  var graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(',');


  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    redirect_uri: req.body.redirectUri,
    client_secret: process.env.FACEBOOK_SECRET
  };
console.log('params:', params);
  // Step 1. Exchange authorization code for access token.
request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
    console.log('accessToken', accessToken)
  if (response.statusCode !== 200) {
    return res.status(500).send({ message: accessToken.error.message });
  }

  // Step 2. Retrieve profile information about the current user.
  request.get({ url: graphApiUrl, qs: accessToken, json: true }, function(err, response, profile) {
    if (response.statusCode !== 200) {
      return res.status(500).send({ message: profile.error.message });
    }
    if (req.header('Authorization')) {
      User.findOne({ facebook: profile.id }, function(err, existingUser) {
        if (existingUser) {
          return res.status(409).send({ message: 'There is already a Facebook account that belongs to you' });
        }
        var token = req.header('Authorization').split(' ')[1];
        var payload = jwt.decode(token, process.env.FACEBOOK_SECRET);
        User.findById(payload.sub, function(err, user) {
          if (!user) {
            return res.status(400).send({ message: 'User not found' });
          }
          user.facebook = profile.id;
        //   user.picture = user.picture || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
        //   user.displayName = user.displayName || profile.name;
          user.save(function() {
            var token = user.makeToken();
            res.send({ token: token });
          });
        });
      });
    } else {
      // Step 3. Create a new user account or return an existing one.
      User.findOne({ facebook: profile.id }, function(err, existingUser) {
        if (existingUser) {
          var token = existingUser.makeToken();
          return res.send({ token: token });
        }
        var user = new User();
        user.facebook = profile.id;
        // user.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
        // user.displayName = profile.name;
        user.save(function() {
          var token = user.makeToken();
          res.send({ token: token });
        });
      });
    }
  });
});
});

module.exports = router;
