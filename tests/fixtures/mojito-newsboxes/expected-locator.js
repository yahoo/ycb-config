/*jslint nomen:true, white:true, node:true */
module.exports = {
    options: {},
    name: 'modown-newsboxes',
    baseDirectory: __dirname,
    type: 'mojito-package',
    resources: {
        '{}': {
            configs: {
                application: 'application.json',
                'package': 'package.json',
                routes: 'routes.json'
            }
        }
    },
    bundles: {
        modown: {
            options: {},
            name: 'modown',
            baseDirectory: __dirname + '/node_modules/modown',
            type: 'mojito-package',
            resources: {
                '{}': {
                    configs: {
                        dimensions: 'dimensions.json',
                        'package': 'package.json'
                    }
                }
            }
        },
        Shelf: {
            options: {
                ruleset: 'mojito-mojit'
            },
            name: 'Shelf',
            baseDirectory: __dirname + '/mojits/Shelf',
            type: 'mojito-mojit',
            resources: {
                '{}': {
                    configs: {
                        definition: 'definition.json'
                    }
                },
            }
        },
        Weather: {
            options: {
                ruleset: 'mojito-mojit'
            },
            name: 'Weather',
            baseDirectory: __dirname + '/mojits/Weather',
            type: 'mojito-mojit',
            resources: {}
        }
    }
};
