const _ = require('lodash/fp');
const axios = require('axios');
const winston = require('winston');
const config = require('./config');

if (!config.FUM_USERNAME || !config.FUM_PASSWORD || !config.FUM_BASEURL) {
  throw new Error('No FUM username, password or host set in config');
}
const client = axios.create({
  baseURL: config.FUM_BASEURL,
  auth: {
    username: config.FUM_USERNAME,
    password: config.FUM_PASSWORD
  }
});

function isFUMUser(username) {
  return getFUMUser(username)
    .then(user => !!user);
}

let employeesCache = null;
function enableCacheInvalidation(interval) {
  function clearCache() {
    winston.info('Clearing user cache');
    employeesCache = null;
    setTimeout(clearCache, interval);
  }
  clearCache();
}
enableCacheInvalidation(900000); // 15 minutes cache

function getFUMUser(username) {
  let employeesPromise;
  if (Array.isArray(employeesCache)) {
    employeesPromise = Promise.resolve(employeesCache);
  } else if (employeesCache) {
    employeesPromise = employeesCache;
  } else {
    winston.info(`Fetching FUM employees from the server`);
    employeesPromise = employeesCache = client.get(`/list/employees/`)
      .then(res => res.data)
      .catch(err => {
        employeesCache = null;
        return Promise.reject(err);
      });
  }
  return employeesPromise
    .then(employees => _.find(employee => employee.username === username, employees))
    .then(employee => _.pick([
        'id',
        'username',
        'first_name',
        'last_name',
        'physical_office',
        'hr_number'
      ], employee));
}

exports.isUser = isFUMUser;
exports.getUser = getFUMUser;
