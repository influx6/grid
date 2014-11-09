var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.Jazz('plate specification', function (_){

  var composable = plug.Composable.make('example');
  composable.registerPlug('append',function(){});
  composable.registerPlugPoint('appender',function(p,sm){ console.log('making appender'); });
  composable.registerPlatePoint('appender',function(p,sm){ console.log('making plate appender'); });

  var composer = plug.Composer.make('dust');
  composable.register(composer);
  var test = composer.useCompose('test');



  _('can i create a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Composer.isType(f));
      expects.truthy(plug.Composer.isInstance(f));
      expects.isFunction(f.compose);
      expects.isFunction(f.point);
      expects.isFunction(f.useCompose);
      expects.isFunction(f.usePoint);
    });
    $.for(composer);
  });

  _('can i create a compose from a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Compose.isType(f));
      expects.truthy(plug.Compose.isInstance(f));
    });
    $.for(test);
  });

  _('can i get a compose from a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(f.id == 'test');
      expects.truthy(plug.Compose.isType(f));
      expects.truthy(plug.Compose.isInstance(f));
      expects.truthy(f.plates);
      expects.truthy(plug.Plate.isInstance(f.plates));
    });
    $.for(composer.compose('test'));
  });

  _('can i create a plug from a compose',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Plug.isType(f));
      expects.truthy(plug.Plug.isInstance(f));
    });
    $.for(test.usePlug('example.append','rack').plug('rack'));
  });

  _('can i create a plugpoint from a compose',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.isFunction(f);
    });
    $.for(test.usePoint('example.appender','rack').point('rack'));
  });

  _('can i create a platepoint from a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.isFunction(f);
    });
    $.for(composer.usePoint('example.appender','rack').point('rack'));
  });
});
