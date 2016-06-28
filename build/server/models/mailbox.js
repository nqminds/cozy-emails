// Generated by CoffeeScript 1.8.0
var Break, FETCH_AT_ONCE, Mailbox, Message, MessagesRemovalByMailbox, NotFound, TestMailbox, async, cozydb, log, mailutils, ramStore, safeLoop, _, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

cozydb = require('cozy-db-pouchdb');

safeLoop = require('../utils/safeloop');

Mailbox = (function(_super) {
  __extends(Mailbox, _super);

  function Mailbox() {
    return Mailbox.__super__.constructor.apply(this, arguments);
  }

  Mailbox.docType = 'Mailbox';

  Mailbox.schema = {
    accountID: String,
    label: String,
    path: String,
    lastSync: String,
    tree: [String],
    delimiter: String,
    uidvalidity: Number,
    attribs: [String],
    lastHighestModSeq: String,
    lastTotal: Number
  };

  Mailbox.RFC6154 = {
    draftMailbox: '\\Drafts',
    sentMailbox: '\\Sent',
    trashMailbox: '\\Trash',
    allMailbox: '\\All',
    junkMailbox: '\\Junk',
    flaggedMailbox: '\\Flagged'
  };

  Mailbox.prototype.isSelectable = function() {
    return __indexOf.call(this.attribs || [], '\\Noselect') < 0;
  };

  Mailbox.prototype.RFC6154use = function() {
    var attribute, field, _ref;
    if (this.path === 'INBOX') {
      return 'inboxMailbox';
    }
    _ref = Mailbox.RFC6154;
    for (field in _ref) {
      attribute = _ref[field];
      if (__indexOf.call(this.attribs, attribute) >= 0) {
        return field;
      }
    }
  };

  Mailbox.prototype.guessUse = function() {
    var path;
    path = this.path.toLowerCase();
    if (/sent/i.test(path)) {
      return 'sentMailbox';
    } else if (/draft/i.test(path)) {
      return 'draftMailbox';
    } else if (/flagged/i.test(path)) {
      return 'flaggedMailbox';
    } else if (/trash/i.test(path)) {
      return 'trashMailbox';
    }
  };

  Mailbox.scanBoxesForSpecialUse = function(boxes) {
    var box, boxAttributes, changes, removeGuesses, type, useRFC6154, _i, _len;
    useRFC6154 = false;
    boxAttributes = Object.keys(Mailbox.RFC6154);
    changes = {
      initialized: true
    };
    removeGuesses = function() {
      var attribute, _i, _len, _results;
      if (!useRFC6154) {
        useRFC6154 = true;
        _results = [];
        for (_i = 0, _len = boxAttributes.length; _i < _len; _i++) {
          attribute = boxAttributes[_i];
          if (attribute !== 'inboxMailbox') {
            _results.push(changes[attribute] = void 0);
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };
    for (_i = 0, _len = boxes.length; _i < _len; _i++) {
      box = boxes[_i];
      type = box.RFC6154use();
      if (type) {
        if (type !== 'inboxMailbox') {
          removeGuesses();
        }
        log.debug('found', type);
        changes[type] = box.id;
      } else if (!useRFC6154) {
        type = box.guessUse();
        if (type) {
          log.debug('found', type, 'guess');
          changes[type] = box.id;
        }
      }
    }
    changes.favorites = Mailbox.pickFavorites(boxes, changes);
    return changes;
  };

  Mailbox.pickFavorites = function(boxes, changes) {
    var box, favorites, id, priorities, type, _i, _j, _len, _len1, _ref;
    favorites = [];
    priorities = ['inboxMailbox', 'allMailbox', 'sentMailbox', 'draftMailbox'];
    for (_i = 0, _len = priorities.length; _i < _len; _i++) {
      type = priorities[_i];
      id = changes[type];
      if (id) {
        favorites.push(id);
      }
    }
    for (_j = 0, _len1 = boxes.length; _j < _len1; _j++) {
      box = boxes[_j];
      if (favorites.length < 4) {
        if ((_ref = box.id, __indexOf.call(favorites, _ref) < 0) && box.isSelectable()) {
          favorites.push(box.id);
        }
      }
    }
    return favorites;
  };

  Mailbox.prototype.doASAP = function(operation, callback) {
    return ramStore.getImapPool(this).doASAP(operation, callback);
  };

  Mailbox.prototype.doASAPWithBox = function(operation, callback) {
    return ramStore.getImapPool(this).doASAPWithBox(this, operation, callback);
  };

  Mailbox.prototype.doLaterWithBox = function(operation, callback) {
    return ramStore.getImapPool(this).doLaterWithBox(this, operation, callback);
  };

  Mailbox.prototype.imapcozy_rename = function(newLabel, newPath, callback) {
    log.debug("imapcozy_rename", newLabel, newPath);
    return this.doASAP((function(_this) {
      return function(imap, cbRelease) {
        return imap.renameBox2(_this.path, newPath, cbRelease);
      };
    })(this), (function(_this) {
      return function(err) {
        log.debug("imapcozy_rename err", err);
        if (err) {
          return callback(err);
        }
        return _this.renameWithChildren(newLabel, newPath, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      };
    })(this));
  };

  Mailbox.prototype.imapcozy_delete = function(callback) {
    var account;
    log.debug("imapcozy_delete");
    account = ramStore.getAccount(this.accountID);
    return async.series([
      (function(_this) {
        return function(cb) {
          log.debug("imap_delete");
          return _this.doASAP(function(imap, cbRelease) {
            return imap.delBox2(_this.path, cbRelease);
          }, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          log.debug("account.forget");
          account = ramStore.getAccount(_this.accountID);
          return account.forgetBox(_this.id, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          var boxes;
          boxes = ramStore.getSelfAndChildrenOf(_this);
          return safeLoop(boxes, function(box, next) {
            return box.destroy(next);
          }, function(errors) {
            return cb(errors[0]);
          });
        };
      })(this)
    ], function(err) {
      return callback(err);
    });
  };

  Mailbox.prototype.renameWithChildren = function(newLabel, newPath, callback) {
    var boxes, depth, path;
    log.debug("renameWithChildren", newLabel, newPath, this.path);
    depth = this.tree.length - 1;
    path = this.path;
    boxes = ramStore.getSelfAndChildrenOf(this);
    log.debug("imapcozy_rename#boxes", boxes.length, depth);
    return async.eachSeries(boxes, function(box, cb) {
      var changes, item;
      log.debug("imapcozy_rename#box", box);
      changes = {};
      changes.path = box.path.replace(path, newPath);
      changes.tree = (function() {
        var _i, _len, _ref, _results;
        _ref = box.tree;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          _results.push(item);
        }
        return _results;
      })();
      changes.tree[depth] = newLabel;
      if (box.tree.length === depth + 1) {
        changes.label = newLabel;
      }
      return box.updateAttributes(changes, cb);
    }, callback);
  };

  Mailbox.prototype.imap_createMailNoDuplicate = function(account, message, callback) {
    var messageID;
    messageID = message.headers['message-id'];
    return this.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.search([['HEADER', 'MESSAGE-ID', messageID]], cb);
    }, (function(_this) {
      return function(err, uids) {
        if (err) {
          return callback(err);
        }
        if (uids != null ? uids[0] : void 0) {
          return callback(null, uids != null ? uids[0] : void 0);
        }
        return account.imap_createMail(_this, message, callback);
      };
    })(this));
  };

  Mailbox.prototype.imap_removeMail = function(uid, callback) {
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return async.series([
        function(cb) {
          return imap.addFlags(uid, '\\Deleted', cb);
        }, function(cb) {
          return imap.expunge(uid, cb);
        }, function(cb) {
          return imap.closeBox(cb);
        }
      ], cbRelease);
    }, callback);
  };

  Mailbox.prototype.imap_expungeMails = function(callback) {
    var box;
    box = this;
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return imap.fetchBoxMessageUIDs(function(err, uids) {
        if (err) {
          return cbRelease(err);
        }
        if (uids.length === 0) {
          return cbRelease(null);
        }
        return async.series([
          function(cb) {
            return imap.addFlags(uids, '\\Deleted', cb);
          }, function(cb) {
            return imap.expunge(uids, cb);
          }, function(cb) {
            return imap.closeBox(cb);
          }
        ], cbRelease);
      });
    }, (function(_this) {
      return function(err) {
        var removal;
        if (err) {
          return callback(err);
        }
        removal = new MessagesRemovalByMailbox({
          mailboxID: _this.id
        });
        return removal.run(callback);
      };
    })(this));
  };

  Mailbox.prototype.ignoreInCount = function() {
    var _ref, _ref1, _ref2;
    return (_ref = Mailbox.RFC6154.trashMailbox, __indexOf.call(this.attribs, _ref) >= 0) || (_ref1 = Mailbox.RFC6154.junkMailbox, __indexOf.call(this.attribs, _ref1) >= 0) || ((_ref2 = this.guessUse()) === 'trashMailbox' || _ref2 === 'junkMailbox');
  };

  return Mailbox;

})(cozydb.CozyModel);

TestMailbox = (function(_super) {
  __extends(TestMailbox, _super);

  function TestMailbox() {
    this.imap_expungeMails = __bind(this.imap_expungeMails, this);
    return TestMailbox.__super__.constructor.apply(this, arguments);
  }

  TestMailbox.prototype.imap_expungeMails = function(callback) {
    var removal;
    removal = new MessagesRemovalByMailbox({
      mailboxID: this.id
    });
    return removal.run(callback);
  };

  return TestMailbox;

})(Mailbox);

module.exports = Mailbox;

require('./model-events').wrapModel(Mailbox);

ramStore = require('./store_account_and_boxes');

Message = require('./message');

log = require('../utils/logging')({
  prefix: 'models:mailbox'
});

_ = require('lodash');

async = require('async');

mailutils = require('../utils/jwz_tools');

MessagesRemovalByMailbox = require('../processes/message_remove_by_mailbox');

_ref = require('../utils/errors'), Break = _ref.Break, NotFound = _ref.NotFound;

FETCH_AT_ONCE = require('../utils/constants').FETCH_AT_ONCE;