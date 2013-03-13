/*jslint nomen:true, white:true, node:true */
module.exports = {
    options: {},
    name: 'modown-newsboxes',
    baseDirectory: __dirname,
    type: 'mojito-package',
    resources: {
        '{}': {
            configs: {
                'application.yaml': 'application.yaml',
                'package.json': 'package.json',
                'routes.json': 'routes.json'
            }
        }
    },
    bundles: {
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
                        'definition.json': 'definition.json'
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
