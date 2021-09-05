// # Get Helper
// Usage: `{{#get "posts" limit="5"}}`, `{{#get "tags" limit="all"}}`
// Fetches data from the API
const {config, logging, errors, i18n, hbs, api} = require('../services/proxy');
const _ = require('lodash');
const Promise = require('bluebird');
const jsonpath = require('jsonpath');

const createFrame = hbs.handlebars.createFrame;

const RESOURCES = {
    posts: {
        alias: 'postsPublic'
    },
    tags: {
        alias: 'tagsPublic'
    },
    pages: {
        alias: 'pagesPublic'
    },
    authors: {
        alias: 'authorsPublic'
    }
};

// Short forms of paths which we should understand
const pathAliases = {
    'post.tags': 'post.tags[*].slug',
    'post.author': 'post.author.slug'
};

/**
 * ## Is Browse
 * Is this a Browse request or a Read request?
 * @param {Object} resource
 * @param {Object} options
 * @returns {boolean}
 */
function isBrowse(options) {
    let browse = true;

    if (options.id || options.slug) {
        browse = false;
    }

    return browse;
}

/**
 * ## Resolve Paths
 * Find and resolve path strings
 *
 * @param {Object} data
 * @param {String} value
 * @returns {String}
 */
function resolvePaths(globals, data, value) {
    const regex = /\{\{(.*?)\}\}/g;

    value = value.replace(regex, function (match, path) {
        let result;

        // Handle aliases
        path = pathAliases[path] ? pathAliases[path] : path;
        // Handle Handlebars .[] style arrays
        path = path.replace(/\.\[/g, '[');

        if (path.charAt(0) === '@') {
            result = jsonpath.query(globals, path.substr(1));
        } else {
            // Do the query, which always returns an array of matches
            result = jsonpath.query(data, path);
        }

        // Handle the case where the single data property we return is a Date
        // Data.toString() is not DB compatible, so use `toISOString()` instead
        if (_.isDate(result[0])) {
            result[0] = result[0].toISOString();
        }

        // Concatenate the results with a comma, handles common case of multiple tag slugs
        return result.join(',');
    });

    return value;
}

/**
 * ## Parse Options
 * Ensure options passed in make sense
 *
 * @param {Object} data
 * @param {Object} options
 * @returns {*}
 */
function parseOptions(globals, data, options) {
    if (_.isString(options.filter)) {
        options.filter = resolvePaths(globals, data, options.filter);
    }

    return options;
}

/**
 * ## Get
 * @param {Object} resource
 * @param {Object} options
 * @returns {Promise}
 */
module.exports = function get(resource, options) {
    options = options || {};
    options.hash = options.hash || {};
    options.data = options.data || {};

    const self = this;
    const start = Date.now();
    const data = createFrame(options.data);
    const ghostGlobals = _.omit(data, ['_parent', 'root']);
    const apiVersion = _.get(data, 'root._locals.apiVersion');
    let apiOptions = options.hash;
    let returnedRowsCount;

    if (!options.fn) {
        data.error = i18n.t('warnings.helpers.mustBeCalledAsBlock', {helperName: 'get'});
        logging.warn(data.error);
        return Promise.resolve();
    }

    if (!RESOURCES[resource]) {
        data.error = i18n.t('warnings.helpers.get.invalidResource');
        logging.warn(data.error);
        return Promise.resolve(options.inverse(self, {data: data}));
    }

    const controllerName = RESOURCES[resource].alias;
    const controller = api[apiVersion][controllerName];
    const action = isBrowse(apiOptions) ? 'browse' : 'read';

    // Parse the options we're going to pass to the API
    apiOptions = parseOptions(ghostGlobals, this, apiOptions);

    // @TODO: https://github.com/TryGhost/Ghost/issues/10548
    return returnCacheAndStartRefetch(controller, action, apiOptions, controllerName).then(function success(result) {
        let blockParams;

        // used for logging details of slow requests
        returnedRowsCount = result[resource] && result[resource].length;

        // block params allows the theme developer to name the data using something like
        // `{{#get "posts" as |result pageInfo|}}`
        blockParams = [result[resource]];
        if (result.meta && result.meta.pagination) {
            result.pagination = result.meta.pagination;
            blockParams.push(result.meta.pagination);
        }

        // Call the main template function
        return options.fn(result, {
            data: data,
            blockParams: blockParams
        });
    }).catch(function error(err) {
        logging.error(err);
        data.error = err.message;
        return options.inverse(self, {data: data});
    }).finally(function () {
        const totalMs = Date.now() - start;
        const logLevel = config.get('logging:slowHelper:level');
        const threshold = config.get('logging:slowHelper:threshold');
        if (totalMs > threshold) {
            logging[logLevel](new errors.HelperWarning({
                message: `{{#get}} helper took ${totalMs}ms to complete`,
                code: 'SLOW_GET_HELPER',
                errorDetails: {
                    api: `${apiVersion}.${controllerName}.${action}`,
                    apiOptions,
                    returnedRows: returnedRowsCount
                }
            }));
        }
    });
};

const cachedResults = {};

// 前回の取得結果がある場合はそれを一旦返して取得結果を更新する。
// 取得結果が存在しない場合は取得してそれを格納した上で返す。
function returnCacheAndStartRefetch(controller, action, apiOptions, controllerName) {
    if (!cachedResults[controllerName]) {
        cachedResults[controllerName] = {};
    }
    if (!cachedResults[controllerName][action]) {
        cachedResults[controllerName][action] = {};
    }

    const stringApiOptions = JSON.stringify(apiOptions);
    const cache = cachedResults[controllerName][stringApiOptions];

    if (cache) {
        if (!cache.isFetching) {
            cache.isFetching = true;
            const promise = controller[action](apiOptions);
            promise.then(function () {
                cache.promise = promise;
                cache.isFetching = false;
            });
        }
        return cache.promise;
    }

    const promise = controller[action](apiOptions);
    cachedResults[controllerName][stringApiOptions] = {
        isFetching: true,
        promise: promise
    };

    promise.then(function () {
        cachedResults[controllerName][stringApiOptions].isFetching = false;
    });

    return promise;
}
