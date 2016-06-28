// Generated by CoffeeScript 1.8.0
var AccountConfigError, BadRequest, CONCURRENT_DESTROY, CONSTANTS, LIMIT_DESTROY, LIMIT_UPDATE, MSGBYPAGE, MailAdress, Mailbox, MailboxRefresh, Message, NotFound, Scheduler, async, cozydb, htmlToText, log, mailutils, ramStore, uuid, _, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

cozydb = require('cozy-db-pouchdb');

ramStore = require('./store_account_and_boxes');

MailAdress = (function(_super) {
  __extends(MailAdress, _super);

  function MailAdress() {
    return MailAdress.__super__.constructor.apply(this, arguments);
  }

  MailAdress.schema = {
    name: String,
    address: String
  };

  return MailAdress;

})(cozydb.Model);

module.exports = Message = (function(_super) {
  __extends(Message, _super);

  function Message() {
    return Message.__super__.constructor.apply(this, arguments);
  }

  Message.docType = 'Message';

  Message.schema = {
    accountID: String,
    messageID: String,
    normSubject: String,
    conversationID: String,
    mailboxIDs: cozydb.NoSchema,
    hasTwin: [String],
    twinMailboxIDs: cozydb.NoSchema,
    flags: [String],
    headers: cozydb.NoSchema,
    from: [MailAdress],
    to: [MailAdress],
    cc: [MailAdress],
    bcc: [MailAdress],
    replyTo: [MailAdress],
    subject: String,
    inReplyTo: [String],
    references: [String],
    text: String,
    html: String,
    date: Date,
    priority: String,
    ignoreInCount: Boolean,
    binary: cozydb.NoSchema,
    attachments: cozydb.NoSchema,
    alternatives: cozydb.NoSchema
  };

  Message.findMultiple = function(ids, callback) {
    return async.mapSeries(ids, function(id, cb) {
      return Message.find(id, cb);
    }, callback);
  };

  Message.pickConversationID = function(rows, callback) {
    var change, conversationID, conversationIDCounts, count, pickedConversationID, pickedConversationIDCount, row, _i, _len, _name;
    log.debug("pickConversationID");
    conversationIDCounts = {};
    for (_i = 0, _len = rows.length; _i < _len; _i++) {
      row = rows[_i];
      if (conversationIDCounts[_name = row.value] == null) {
        conversationIDCounts[_name] = 1;
      }
      conversationIDCounts[row.value]++;
    }
    pickedConversationID = null;
    pickedConversationIDCount = 0;
    for (conversationID in conversationIDCounts) {
      count = conversationIDCounts[conversationID];
      if (count > pickedConversationIDCount) {
        pickedConversationID = conversationID;
        pickedConversationIDCount = count;
      }
    }
    if (!((pickedConversationID != null) && pickedConversationID !== 'undefined')) {
      pickedConversationID = uuid.v4();
    }
    change = {
      conversationID: pickedConversationID
    };
    return async.eachSeries(rows, function(row, cb) {
      if (row.value === pickedConversationID) {
        return cb(null);
      }
      return Message.find(row.id, function(err, message) {
        if (err) {
          log.warn("Cant get message " + row.id + ", ignoring");
        }
        if (err || message.conversationID === pickedConversationID) {
          return cb(null);
        } else {
          return message.updateAttributes(change, cb);
        }
      });
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, pickedConversationID);
    });
  };

  Message.findConversationID = function(mail, callback) {
    var isReplyOrForward, key, keys, references, subject, _ref;
    log.debug("findConversationID");
    subject = mail.subject;
    isReplyOrForward = subject && mailutils.isReplyOrForward(subject);
    references = mail.references || [];
    references.concat(mail.inReplyTo || []);
    references = references.map(mailutils.normalizeMessageID).filter(function(mid) {
      return mid;
    });
    log.debug("findConversationID", references, mail.normSubject, isReplyOrForward);
    if (references.length) {
      keys = references.map(function(mid) {
        return [mail.accountID, 'mid', mid];
      });
      return Message.rawRequest('dedupRequest', {
        keys: keys
      }, function(err, rows) {
        if (err) {
          return callback(err);
        }
        log.debug('   found = ', rows != null ? rows.length : void 0);
        return Message.pickConversationID(rows, callback);
      });
    } else if (((_ref = mail.normSubject) != null ? _ref.length : void 0) > 3 && isReplyOrForward) {
      key = [mail.accountID, 'subject', mail.normSubject];
      return Message.rawRequest('dedupRequest', {
        key: key
      }, function(err, rows) {
        if (err) {
          return callback(err);
        }
        log.debug("found similar", rows.length);
        return Message.pickConversationID(rows, callback);
      });
    } else {
      return callback(null, uuid.v4());
    }
  };

  Message.UIDsInCozy = function(mailboxID, callback) {};

  Message.byMessageID = function(accountID, messageID, callback) {
    messageID = mailutils.normalizeMessageID(messageID);
    return Message.rawRequest('dedupRequest', {
      key: [accountID, 'mid', messageID],
      include_docs: true
    }, function(err, rows) {
      var message, _ref;
      if (err) {
        return callback(err);
      }
      message = (_ref = rows[0]) != null ? _ref.doc : void 0;
      if (message) {
        message = new Message(message);
      }
      return callback(null, message);
    });
  };

  Message.getConversationLengths = function(conversationIDs, callback) {
    return Message.rawRequest('byConversationID', {
      keys: conversationIDs,
      group: true,
      reduce: true
    }, function(err, rows) {
      var out, row, _i, _len;
      if (err) {
        return callback(err);
      }
      out = {};
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        out[row.key] = row.value;
      }
      return callback(null, out);
    });
  };

  Message.byConversationID = function(conversationID, callback) {
    return Message.byConversationIDs([conversationID], callback);
  };

  Message.byConversationIDs = function(conversationIDs, callback) {
    return Message.rawRequest('byConversationID', {
      keys: conversationIDs,
      reduce: false,
      include_docs: true
    }, function(err, rows) {
      var messages;
      if (err) {
        return callback(err);
      }
      messages = rows.map(function(row) {
        try {
          return new Message(row.doc);
        } catch (_error) {
          err = _error;
          log.error("Wrong message", err, row.doc);
          return null;
        }
      });
      return callback(null, messages);
    });
  };

  Message.removeFromMailbox = function(id, box, callback) {
    log.debug("removeFromMailbox", id, box.label);
    return Message.find(id, function(err, message) {
      if (err) {
        return callback(err);
      }
      if (!message) {
        return callback(new NotFound("Message " + id));
      }
      return message.removeFromMailbox(box, false, callback);
    });
  };

  Message.getResultsAndCount = function(mailboxID, params, callback) {
    var _ref;
    if (params.flag == null) {
      params.flag = null;
    }
    if (params.descending) {
      _ref = [params.after, params.before], params.before = _ref[0], params.after = _ref[1];
    }
    return async.parallel([
      function(cb) {
        return Message.getCount(mailboxID, params, cb);
      }, function(cb) {
        return Message.getResults(mailboxID, params, cb);
      }
    ], function(err, results) {
      var conversationIDs, count, messages;
      if (err) {
        return callback(err);
      }
      count = results[0], messages = results[1];
      conversationIDs = _.uniq(_.pluck(messages, 'conversationID'));
      return Message.getConversationLengths(conversationIDs, function(err, lengths) {
        if (err) {
          return callback(err);
        }
        return callback(null, {
          messages: messages,
          count: count,
          conversationLengths: lengths
        });
      });
    });
  };

  Message.getResults = function(mailboxID, params, callback) {
    var after, before, descending, endkey, flag, requestOptions, skip, sortField, startkey;
    before = params.before, after = params.after, descending = params.descending, sortField = params.sortField, flag = params.flag;
    skip = 0;
    if (sortField === 'from' || sortField === 'dest') {
      if (params.resultsAfter != null) {
        skip = params.resultsAfter;
      }
      startkey = [sortField, mailboxID, flag, before, null];
      endkey = [sortField, mailboxID, flag, after, null];
    } else {
      if (params.resultsAfter != null) {
        startkey = [sortField, mailboxID, flag, params.resultsAfter];
      } else {
        startkey = [sortField, mailboxID, flag, before];
      }
      endkey = [sortField, mailboxID, flag, after];
    }
    requestOptions = {
      descending: descending,
      startkey: startkey,
      endkey: endkey,
      reduce: false,
      skip: skip,
      include_docs: true,
      limit: MSGBYPAGE
    };
    return Message.rawRequest('byMailboxRequest', requestOptions, function(err, rows) {
      if (err) {
        return callback(err);
      }
      return callback(null, rows.map(function(row) {
        return new Message(row.doc);
      }));
    });
  };

  Message.getCount = function(mailboxID, params, callback) {
    var after, before, descending, flag, sortField;
    before = params.before, after = params.after, descending = params.descending, sortField = params.sortField, flag = params.flag;
    return Message.rawRequest('byMailboxRequest', {
      descending: descending,
      startkey: [sortField, mailboxID, flag, before],
      endkey: [sortField, mailboxID, flag, after],
      reduce: true,
      group_level: 2
    }, function(err, rows) {
      var _ref;
      if (err) {
        return callback(err);
      }
      return callback(null, ((_ref = rows[0]) != null ? _ref.value : void 0) || 0);
    });
  };

  Message.updateOrCreate = function(message, callback) {
    log.debug("create or update");
    if (message.id) {
      return Message.find(message.id, function(err, existing) {
        log.debug("update");
        if (err) {
          return callback(err);
        } else if (!existing) {
          return callback(new NotFound("Message " + message.id));
        } else {
          message.binary = existing.binary;
          return existing.updateAttributes(message, callback);
        }
      });
    } else {
      log.debug("create");
      return Message.create(message, callback);
    }
  };

  Message.fetchOrUpdate = function(box, msg, callback) {
    var mid, uid;
    mid = msg.mid, uid = msg.uid;
    log.debug("fetchOrUpdate", box.id, mid, uid);
    return Message.byMessageID(box.accountID, mid, function(err, existing) {
      if (err) {
        return callback(err);
      }
      if (existing && !existing.isInMailbox(box)) {
        log.debug("        add");
        return existing.addToMailbox(box, uid, callback);
      } else if (existing) {
        log.debug("        twin");
        return existing.markTwin(box, uid, callback);
      } else {
        log.debug("        fetch");
        return Message.fetchOneMail(box, uid, callback);
      }
    });
  };

  Message.fetchOneMail = function(box, uid, callback) {
    return box.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.fetchOneMail(uid, cb);
    }, function(err, mail) {
      var shouldNotif;
      if (err) {
        return callback(err);
      }
      shouldNotif = __indexOf.call(mail.flags || [], '\\Seen') >= 0;
      return Message.createFromImapMessage(mail, box, uid, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, {
          shouldNotif: shouldNotif,
          actuallyAdded: true
        });
      });
    });
  };

  Message.prototype.markTwin = function(box, uid, callback) {
    var hasTwin, twinMailboxIDs, twinMailboxIDsBox, _name, _name1, _ref, _ref1;
    hasTwin = this.hasTwin || [];
    twinMailboxIDs = this.twinMailboxIDs || {};
    twinMailboxIDsBox = twinMailboxIDs[box.id] || [];
    if ((_ref = box.id, __indexOf.call(hasTwin, _ref) >= 0) && __indexOf.call(twinMailboxIDsBox, uid) >= 0) {
      return callback(null, {
        shouldNotif: false,
        actuallyAdded: false
      });
    } else if (_ref1 = box.id, __indexOf.call(hasTwin, _ref1) >= 0) {
      if (twinMailboxIDs[_name = box.id] == null) {
        twinMailboxIDs[_name] = [];
      }
      twinMailboxIDs[box.id].push(uid);
      return this.updateAttributes({
        twinMailboxIDs: twinMailboxIDs
      }, function(err) {
        return callback(err, {
          shouldNotif: false,
          actuallyAdded: true
        });
      });
    } else {
      hasTwin.push(box.id);
      if (twinMailboxIDs[_name1 = box.id] == null) {
        twinMailboxIDs[_name1] = [];
      }
      twinMailboxIDs[box.id].push(uid);
      return this.updateAttributes({
        hasTwin: hasTwin,
        twinMailboxIDs: twinMailboxIDs
      }, function(err) {
        return callback(err, {
          shouldNotif: false,
          actuallyAdded: true
        });
      });
    }
  };

  Message.prototype.addToMailbox = function(box, uid, callback) {
    var changes, key, mailboxIDs, value, _ref;
    log.info("MAIL " + box.path + ":" + uid + " ADDED TO BOX");
    mailboxIDs = {};
    _ref = this.mailboxIDs || {};
    for (key in _ref) {
      value = _ref[key];
      mailboxIDs[key] = value;
    }
    mailboxIDs[box.id] = uid;
    changes = {
      mailboxIDs: mailboxIDs
    };
    changes.ignoreInCount = box.ignoreInCount();
    return this.updateAttributes(changes, function(err) {
      return callback(err, {
        shouldNotif: false,
        actuallyAdded: true
      });
    });
  };

  Message.prototype.isInMailbox = function(box) {
    return (this.mailboxIDs[box.id] != null) && this.mailboxIDs[box.id] !== -1;
  };

  Message.prototype.removeFromMailbox = function(box, noDestroy, callback) {
    var boxes, changed, changes, isOrphan;
    if (noDestroy == null) {
      noDestroy = false;
    }
    log.debug(".removeFromMailbox", this.id, box.label);
    if (!callback) {
      callback = noDestroy;
    }
    changes = {};
    changed = false;
    if (box.id in (this.mailboxIDs || {})) {
      changes.mailboxIDs = _.omit(this.mailboxIDs, box.id);
      changed = true;
    }
    if (box.id in (this.twinMailboxIDs || {})) {
      changes.twinMailboxIDs = _.omit(this.twinMailboxIDs, box.id);
      changed = true;
    }
    if (changed) {
      boxes = Object.keys(changes.mailboxIDs || this.mailboxIDs);
      isOrphan = boxes.length === 0;
      log.debug("REMOVING " + this.id + ", NOW ORPHAN = ", isOrphan);
      if (isOrphan && !noDestroy) {
        return this.destroy(callback);
      } else {
        return this.updateAttributes(changes, callback);
      }
    } else {
      return setImmediate(callback);
    }
  };

  Message.createFromImapMessage = function(mail, box, uid, callback) {
    var attachments, messageID;
    log.info("createFromImapMessage", box.label, uid);
    log.debug('flags = ', mail.flags);
    mail.accountID = box.accountID;
    mail.ignoreInCount = box.ignoreInCount();
    mail.mailboxIDs = {};
    mail.mailboxIDs[box._id] = uid;
    messageID = mail.headers['message-id'];
    delete mail.messageId;
    if (messageID && messageID instanceof Array) {
      messageID = messageID[0];
    }
    if (messageID) {
      mail.messageID = mailutils.normalizeMessageID(messageID);
    }
    if (mail.subject) {
      mail.normSubject = mailutils.normalizeSubject(mail.subject);
    }
    if (mail.replyTo == null) {
      mail.replyTo = [];
    }
    if (mail.cc == null) {
      mail.cc = [];
    }
    if (mail.bcc == null) {
      mail.bcc = [];
    }
    if (mail.to == null) {
      mail.to = [];
    }
    if (mail.from == null) {
      mail.from = [];
    }
    if (mail.date == null) {
      mail.date = new Date().toISOString();
    }
    attachments = [];
    if (mail.attachments) {
      attachments = mail.attachments.map(function(att) {
        var buffer, out;
        buffer = att.content;
        delete att.content;
        return out = {
          name: att.generatedFileName,
          buffer: buffer
        };
      });
    }
    return Message.findConversationID(mail, function(err, conversationID) {
      if (err) {
        return callback(err);
      }
      mail.conversationID = conversationID;
      return Message.create(mail, function(err, jdbMessage) {
        if (err) {
          return callback(err);
        }
        return jdbMessage.storeAttachments(attachments, callback);
      });
    });
  };

  Message.prototype.storeAttachments = function(attachments, callback) {
    log.debug("storeAttachments");
    return async.eachSeries(attachments, (function(_this) {
      return function(att, cb) {
        if (att.buffer == null) {
          att.buffer = new Buffer(0);
        }
        att.buffer.path = encodeURI(att.name);
        return _this.attachBinary(att.buffer, {
          name: att.name
        }, cb);
      };
    })(this), callback);
  };

  Message.prototype.toClientObject = function() {
    var attachments, err, raw, _ref;
    raw = this.toObject();
    if ((_ref = raw.attachments) != null) {
      _ref.forEach(function(file) {
        var encodedFileName;
        encodedFileName = encodeURIComponent(file.generatedFileName);
        return file.url = "message/" + raw.id + "/attachments/" + encodedFileName;
      });
    }
    if (raw.html != null) {
      attachments = raw.attachments || [];
      raw.html = mailutils.sanitizeHTML(raw.html, raw.id, attachments);
    }
    if ((raw.text == null) && (raw.html != null)) {
      try {
        raw.text = htmlToText.fromString(raw.html, {
          tables: true,
          wordwrap: 80
        });
      } catch (_error) {
        err = _error;
        log.error("Error converting HTML to text", err, raw.html);
      }
    }
    return raw;
  };

  Message.doGroupedByBox = function(messages, iterator, done) {
    var accountID, boxID, message, messagesByBoxID, state, uid, _i, _len, _ref;
    if (messages.length === 0) {
      return done(null);
    }
    accountID = messages[0].accountID;
    messagesByBoxID = {};
    for (_i = 0, _len = messages.length; _i < _len; _i++) {
      message = messages[_i];
      _ref = message.mailboxIDs;
      for (boxID in _ref) {
        uid = _ref[boxID];
        if (messagesByBoxID[boxID] == null) {
          messagesByBoxID[boxID] = [];
        }
        messagesByBoxID[boxID].push(message);
      }
    }
    state = {};
    return async.eachSeries(Object.keys(messagesByBoxID), function(boxID, next) {
      var iterator2, pool;
      state.box = ramStore.getMailbox(boxID);
      state.messagesInBox = messagesByBoxID[boxID];
      iterator2 = function(imap, imapBox, releaseImap) {
        state.imapBox = imapBox;
        state.uids = state.messagesInBox.map(function(msg) {
          return msg.mailboxIDs[state.box.id];
        });
        return iterator(imap, state, releaseImap);
      };
      pool = ramStore.getImapPool(messages[0]);
      return pool.doASAPWithBox(state.box, iterator2, next);
    }, done);
  };

  Message.batchAddFlag = function(messages, flag, callback) {
    messages = messages.filter(function(msg) {
      return __indexOf.call(msg.flags, flag) < 0;
    });
    return Message.doGroupedByBox(messages, function(imap, state, next) {
      return imap.addFlags(state.uids, flag, next);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return async.mapSeries(messages, function(message, next) {
        var newflags;
        newflags = message.flags.concat(flag);
        return message.updateAttributes({
          flags: newflags
        }, function(err) {
          return next(err, message);
        });
      }, callback);
    });
  };

  Message.batchRemoveFlag = function(messages, flag, callback) {
    messages = messages.filter(function(msg) {
      return __indexOf.call(msg.flags, flag) >= 0;
    });
    return Message.doGroupedByBox(messages, function(imap, state, next) {
      return imap.delFlags(state.uids, flag, next);
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return async.mapSeries(messages, function(message, next) {
        var newflags;
        newflags = _.without(message.flags, flag);
        return message.updateAttributes({
          flags: newflags
        }, function(err) {
          return next(err, message);
        });
      }, callback);
    });
  };

  Message.batchMove = function(messages, from, to, callback) {
    var alreadyMoved, changes, destBoxes, fromBox, ignores;
    if (!Array.isArray(to)) {
      to = [to];
    }
    messages = messages.filter(function(msg) {
      var boxes;
      boxes = Object.keys(msg.mailboxIDs);
      return _.xor(boxes, to).length > 1;
    });
    fromBox = null;
    destBoxes = null;
    alreadyMoved = [];
    changes = {};
    ignores = null;
    log.debug("batchMove", messages.length, from, to);
    return Message.doGroupedByBox(messages, function(imap, state, nextBox) {
      var currentBox, destBox, destString, expunges, id, message, moves, mustRemove, paths, uid, _i, _j, _len, _len1, _ref;
      if (fromBox == null) {
        fromBox = ramStore.getMailbox(from);
      }
      if (destBoxes == null) {
        destBoxes = to.map(function(id) {
          return ramStore.getMailbox(id);
        });
      }
      if (ignores == null) {
        ignores = ramStore.getIgnoredMailboxes();
      }
      currentBox = state.box;
      destString = to.join(',');
      if (__indexOf.call(destBoxes, void 0) >= 0) {
        return nextBox(new Error("One of destination boxes " + destString + " doesnt exist"));
      }
      if (__indexOf.call(destBoxes, currentBox) >= 0) {
        return nextBox(null);
      }
      mustRemove = currentBox === fromBox || !from;
      moves = [];
      expunges = [];
      _ref = state.messagesInBox;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        message = _ref[_i];
        id = message.id;
        uid = message.mailboxIDs[currentBox.id];
        if (message.mailboxIDs[to] || __indexOf.call(alreadyMoved, id) >= 0) {
          if (mustRemove) {
            expunges.push(uid);
            if (changes[id] == null) {
              changes[id] = message.cloneMailboxIDs();
            }
            delete changes[id][currentBox.id];
          }
        } else if (message.isDraft() && from === null) {
          expunges.push(uid);
          if (changes[id] == null) {
            changes[id] = message.cloneMailboxIDs();
          }
          delete changes[id][currentBox.id];
        } else {
          moves.push(uid);
          alreadyMoved.push(id);
          if (changes[id] == null) {
            changes[id] = message.cloneMailboxIDs();
          }
          delete changes[id][currentBox.id];
          for (_j = 0, _len1 = destBoxes.length; _j < _len1; _j++) {
            destBox = destBoxes[_j];
            changes[id][destBox.id] = -1;
          }
        }
      }
      log.debug("MOVING", moves, "FROM", currentBox.id, "TO", destString);
      log.debug("EXPUNGING", expunges, "FROM", currentBox.id);
      paths = destBoxes.map(function(box) {
        return box.path;
      });
      return imap.multimove(moves, paths, function(err, result) {
        if (err) {
          return nextBox(err);
        }
        return imap.multiexpunge(expunges, function(err) {
          if (err) {
            return nextBox(err);
          }
          return nextBox(null);
        });
      });
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return async.mapSeries(messages, function(message, next) {
        var data, newMailboxIDs;
        newMailboxIDs = changes[message.id];
        if (!newMailboxIDs) {
          return next(null, message);
        } else {
          data = {
            mailboxIDs: newMailboxIDs,
            ignoreInCount: Object.keys(newMailboxIDs).some(function(id) {
              return ignores[id];
            })
          };
          return message.updateAttributes(data, function(err) {
            return next(err, message);
          });
        }
      }, function(err, updated) {
        var limitByBox, refreshes;
        if (err) {
          return callback(err);
        }
        if (updated.length === 0 || (destBoxes == null)) {
          return callback(null, []);
        }
        limitByBox = Math.max(100, messages.length * 2);
        refreshes = destBoxes.map(function(mailbox) {
          return new MailboxRefresh({
            mailbox: mailbox,
            limitByBox: limitByBox
          });
        });
        return Scheduler.scheduleMultiple(refreshes, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, updated);
        });
      });
    });
  };

  Message.batchTrash = function(messages, trashBoxID, callback) {
    return this.batchMove(messages, null, trashBoxID, callback);
  };

  Message.prototype.cloneMailboxIDs = function() {
    var boxID, out, uid, _ref;
    out = {};
    _ref = this.mailboxIDs;
    for (boxID in _ref) {
      uid = _ref[boxID];
      out[boxID] = uid;
    }
    return out;
  };

  Message.prototype.isDraft = function(draftBoxID) {
    return (this.mailboxIDs[draftBoxID] != null) || __indexOf.call(this.flags, '\\Draft') >= 0;
  };

  return Message;

})(cozydb.CozyModel);

module.exports = Message;

mailutils = require('../utils/jwz_tools');

CONSTANTS = require('../utils/constants');

MSGBYPAGE = CONSTANTS.MSGBYPAGE, LIMIT_DESTROY = CONSTANTS.LIMIT_DESTROY, LIMIT_UPDATE = CONSTANTS.LIMIT_UPDATE, CONCURRENT_DESTROY = CONSTANTS.CONCURRENT_DESTROY;

_ref = require('../utils/errors'), NotFound = _ref.NotFound, BadRequest = _ref.BadRequest, AccountConfigError = _ref.AccountConfigError;

uuid = require('uuid');

_ = require('lodash');

async = require('async');

log = require('../utils/logging')({
  prefix: 'models:message'
});

Mailbox = require('./mailbox');

htmlToText = require('html-to-text');

MailboxRefresh = require('../processes/mailbox_refresh');

Scheduler = require('../processes/_scheduler');

require('./model-events').wrapModel(Message);