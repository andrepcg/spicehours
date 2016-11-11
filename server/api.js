const _ = require('lodash/fp');
const express = require('express');
const contracts = require('./eth').contracts;
const utils = require('./utils');

const router = express.Router();
const SpiceMembers = contracts.SpiceMembers.deployed();
const SpiceHours = contracts.SpiceHours.deployed();

const LEVEL_OWNER = 'Owner';
function levelName(level) {
  switch (level) {
    case 0:
      return 'None';
    case 1:
      return 'Member';
    case 2:
      return 'Manager';
    case 3:
      return 'Director';
    default:
      throw new Error('Unknown level: ' + level);
  }
}

const NULL_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

function getMember(memberAddress) {
  return Promise.all([
    SpiceMembers.owner(),
    SpiceMembers.memberId(memberAddress),
    SpiceMembers.memberLevel(memberAddress),
    SpiceMembers.memberInfo(memberAddress)
  ]).then(function(data) {
    var member = {
      id: data[1].toNumber()
    };

    if (memberAddress === data[0]) {
      member.level = LEVEL_OWNER;
    } else {
      member.level = levelName(data[2].toNumber());
    }

    if (data[3] !== NULL_BYTES32) {
      member.info = utils.decryptInfo(data[3]);
    }

    return member;
  });
}

router.get('/members/', (req, res, next) => {
  var i;

  SpiceMembers.memberCount()
    .then(function(count) {
      var promises = [];
      for (i = 1; i<=count.valueOf(); i++) {
        promises.push(SpiceMembers.memberAddress(i));
      }
      return Promise.all(promises);
    })
    .then(function(addresses) {
      return Promise.all(
        addresses.map(getMember)
      );
    })
    .then(function(members) { res.json(members) })
    .catch(next);
});

function handleTransaction(method, ...args) {
  if (!_.isPlainObject(_.last(args)))
    args.push({});

  return _.spread(method.estimateGas)(args)
    .then(usedGas => {
      const options = _.assoc('gas', usedGas, _.last(args));
      const newArgs = _.concat(_.dropRight(1, args), [options]);
      return _.spread(method)(newArgs);
    });
}

router.post('/users/:info/markings', (req, res, next) => {
  if (!_.isNumber(req.body.duration))
    return res.status(400).json({ error: 'Bad Request' });

  const info = utils.encryptInfo(req.params.info);
  const descr = utils.strToBytes32(req.body.description);
  const duration = req.body.duration;

  handleTransaction(SpiceHours.markHours, info, descr, duration)
    .then(function(txid) {
    res.status(204).send();
  }).catch(next);
});

router.get('/users/:info/markings', (req, res, next) => {
  var filter = {_info: utils.encryptInfo(req.params.info)};
  SpiceHours.MarkHours(filter).get(function(err, events) {
    if (err) return next(err);
    res.json(events);
  });
});

module.exports = router;
