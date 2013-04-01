/*jslint nomen:true, white:true, node:true */
var rosterController = function() {};

module.exports = function (app) {
  app.get('/', rosterController);
};
