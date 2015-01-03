/// <reference path='../node_modules/stacks/lib/ts/stacks.d.ts' />
var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.JzGroup('plug channel specification', function (_){
    var sc = plug.SelectedChannel.make('rock');
    var tc = plug.TaskChannel.make('rock');
    var rc = plug.ReplyChannel.make('rock');

    var tm = plug.Packets.Task('rock');
    tm.emit({'uuid':1,'data':'fox'});
    tm.emit({'uuid':3,'data':'wolf'});
    tm.emit({'uuid':4,'data':'chicken'});
    var rm = plug.Packets.Reply('rock');
    rm.emit(0x32FFF232);

    tc.emit(tm);
    tc.emit(rm);
    rc.emit(tm);
    rc.emit(rm);

    _('can i create a channel',function($) {
        $.sync(function (c) {
          expects.isObject(c);
        });
        $.for(sc);
    });

    _('can i create a selected channel',function($) {
        $.sync(function (c) {
            expects.isObject(c);
            expects.isTrue(plug.Channel.isType(c));
            expects.isTrue(plug.SelectedChannel.isType(c));
        });
        $.for(sc);
    });

    _('can i create a task channel',function($) {
        $.sync(function (c) {
            expects.isObject(c);
            expects.isTrue(plug.Channel.isType(c));
            expects.isTrue(plug.TaskChannel.isType(c));
        });
        $.for(tc);
    });

    _('can i create a reply channel',function($) {
        $.sync(function (c) {
            expects.isObject(c);
            expects.isTrue(plug.SelectedChannel.isType(c));
            expects.isTrue(plug.ReplyChannel.isType(c));
        });
        $.for(rc);
    });

    _('can i emit data within a channel',function($){
      $.async(function(c,next,g){
        c.once(g(function(f){
          expects.isObject(f);
        }));
        c.emit({'name':'alex'});
        return next();
      });

      $.for(sc);
    });

    _('can i emit only tasks in tasks channels',function($){
      $.sync(function(c,g){
        c.on(g(function(f){
          expects.isObject(f);
        }));
      });

      $.for(tc);
    });

    _('can i emit only replies in replies channels',function($){
      $.sync(function(c,g){
        c.on(g(function(f){
          expects.isObject(f);
        }));
      });

      $.for(rc);
    });

});
