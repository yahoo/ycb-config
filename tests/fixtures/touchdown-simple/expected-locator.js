/*jslint nomen:true, white:true, node:true */
module.exports = {
    options: {},
    name: 'simple',
    baseDirectory: __dirname,
    type: 'touchdown-package',
    resources: {
        '{}': {
            configs: {
                app: 'configs/app.json',
                dimensions: 'configs/dimensions.json',
                routes: 'configs/routes.js'
            },
        }
    },
    bundles: {
        roster: {
            options: {},
            name: 'roster',
            baseDirectory: __dirname + '/node_modules/roster',
            type: 'touchdown-package',
            resources: {
                '{}': {
                    configs: {
                        roster: 'configs/roster.json'
                    }
                }
            }
        }
    }
};
