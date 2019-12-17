'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const common = require('./lib/common/events');
const models = require('./models');
const config = require('../shared/config');

const ADMINS = config.get('trap:admins');
if (!ADMINS) {
    throw new common.errors.IncorrectUsageError({
        message: 'No admin found'
    });
}

const JWT_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAraewUw7V1hiuSgUvkly9
X+tcIh0e/KKqeFnAo8WR3ez2tA0fGwM+P8sYKHIDQFX7ER0c+ecTiKpo/Zt/a6AO
gB/zHb8L4TWMr2G4q79S1gNw465/SEaGKR8hRkdnxJ6LXdDEhgrH2ZwIPzE0EVO1
eFrDms1jS3/QEyZCJ72oYbAErI85qJDF/y/iRgl04XBK6GLIW11gpf8KRRAh4vuh
g5/YhsWUdcX+uDVthEEEGOikSacKZMFGZNi8X8YVnRyWLf24QTJnTHEv+0EStNrH
HnxCPX0m79p7tBfFC2ha2OYfOtA+94ZfpZXUi2r6gJZ+dq9FWYyA0DkiYPUq9QMb
OQIDAQAB
-----END PUBLIC KEY-----
`.trim();

const randomPassword = () => {
    return crypto
        .createHash('sha512')
        .update('' + Math.random())
        .digest('base64');
};

const parser = async (req, res, next) => {
    try {
        const rawToken = req.cookies.traP_token;
        if (!rawToken) {
            throw new Error('No token');
        }

        // throws Error
        const {id: name, email} = jwt.verify(rawToken, JWT_PUBLIC_KEY, {
            algorithms: 'RS256'
        });

        const [user, role] = await Promise.all([
            models.User.findOne({name}),
            models.Role.findOne({
                name: ADMINS.includes(name)
                    ? 'Administrator'
                    : 'Author'
            })
        ]);

        const modifiedUser = await models.User[user ? 'edit' : 'add'](
            {
                email,
                name,
                slug: name.toLowerCase(),
                password: randomPassword(),
                roles: [role]
            },
            {
                id: user ? user.id : null,
                context: {internal: true}
            }
        );

        if (modifiedUser.isLocked()) {
            throw new Error(common.i18n.t('errors.models.user.accountLocked'));
        }

        if (modifiedUser.isInactive()) {
            throw new Error(
                common.i18n.t('errors.models.user.accountSuspended')
            );
        }

        req.user = modifiedUser;
    } catch (err) {
        req.body.trap_id = {err: `traP ID ${err}`};
    }

    next();
};

const signIn = async (body) => {
    if (body.trap_id.err) {
        throw new Error(body.trap_id.err);
    }
    return body.trap_id.user;
};

module.exports = {parser, signIn};
