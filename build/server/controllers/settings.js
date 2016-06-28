// Generated by CoffeeScript 1.8.0
var Settings;

Settings = require('../models/settings');

module.exports = {
  get: function(req, res, next) {
    return Settings.get(function(err, settings) {
      if (err) {
        return next(err);
      }
      return res.send(settings);
    });
  },
  change: function(req, res, next) {
    return Settings.set(req.body, function(err, updated) {
      if (err) {
        return next(err);
      }
      return res.send(updated);
    });
  }
};