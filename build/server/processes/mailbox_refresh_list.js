// Generated by CoffeeScript 1.8.0
var Mailbox, MailboxRefreshList, Process, async, log, ramStore, safeLoop, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Process = require('./_base');

log = require('../utils/logging')({
  prefix: 'process:mailbox_refresh'
});

async = require('async');

ramStore = require('../models/store_account_and_boxes');

_ = require('lodash');

Mailbox = require('../models/mailbox');

safeLoop = require('../utils/safeloop');

module.exports = MailboxRefreshList = (function(_super) {
  __extends(MailboxRefreshList, _super);

  function MailboxRefreshList() {
    this.destroyOldBoxes = __bind(this.destroyOldBoxes, this);
    this.createNewBoxes = __bind(this.createNewBoxes, this);
    this.diffBoxesList = __bind(this.diffBoxesList, this);
    return MailboxRefreshList.__super__.constructor.apply(this, arguments);
  }

  MailboxRefreshList.prototype.code = 'mailbox-refresh-list';

  MailboxRefreshList.prototype.initialize = function(options, callback) {
    this.account = options.account;
    return async.series([this.diffBoxesList, this.createNewBoxes, this.destroyOldBoxes], callback);
  };

  MailboxRefreshList.prototype.diffBoxesList = function(callback) {
    var cozyBoxes;
    cozyBoxes = ramStore.getMailboxesByAccount(this.account.id);
    return this.account.imap_getBoxes((function(_this) {
      return function(err, imapBoxes) {
        log.debug("refreshBoxes#results", cozyBoxes.length);
        if (err) {
          return callback(err);
        }
        _this.created = imapBoxes.filter(function(box) {
          return !_.findWhere(cozyBoxes, {
            path: box.path
          });
        });
        _this.destroyed = cozyBoxes.filter(function(box) {
          return !_.findWhere(imapBoxes, {
            path: box.path
          });
        });
        log.debug("refreshBoxes#results2", _this.created.length, imapBoxes.length, _this.destroyed.length);
        return callback(null);
      };
    })(this));
  };

  MailboxRefreshList.prototype.createNewBoxes = function(callback) {
    log.debug("creating", this.created.length, "boxes");
    return safeLoop(this.created, (function(_this) {
      return function(box, next) {
        box.accountID = _this.account.id;
        return Mailbox.create(box, next);
      };
    })(this), function(errors) {
      var err, _i, _len;
      for (_i = 0, _len = errors.length; _i < _len; _i++) {
        err = errors[_i];
        log.error('fail to create box', err);
      }
      return callback(null);
    });
  };

  MailboxRefreshList.prototype.destroyOldBoxes = function(callback) {
    log.debug("destroying", this.destroyed.length, "boxes");
    return safeLoop(this.destroyed, (function(_this) {
      return function(box, next) {
        return box.destroy(function(err) {
          if (err) {
            log.error('fail to destroy box', err);
          }
          return _this.account.forgetBox(box.id, next);
        });
      };
    })(this), function(errors) {
      var err, _i, _len;
      for (_i = 0, _len = errors.length; _i < _len; _i++) {
        err = errors[_i];
        log.error('fail to forget box', err);
      }
      return callback(null);
    });
  };

  return MailboxRefreshList;

})(Process);
