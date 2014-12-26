var stacks = require("stackq");

var MessagePicker = function(n){ return n['message']; };
var inNext = function(n,e){ return n(); };
var tasks = 0x24677B434A323;
var replies = 0x1874F43FF45;
var packets = 0x1874F43FF45;


var PacketSchema = stacks.Schema({},{
    message: 'string',
    stream: 'stream',
    tag: 'number',
    uuid: 'string',
    cid: packets,
    'origin?':'string',
  },{
    uuid:{
      maxWrite: 1,
    },
    stream:{
      maxWrite: 1,
    },
    cid:{
      copy: true,
    },
    tag:{
      maxWrite: 1,
    },
    message:{
      maxWrite: 1,
    },
  },{
  stream: function(f,fn){
    return fn(stacks.Stream.isType(f));
  }
});

var Packets = exports.Packets = function(id,tag,body){
  var shell = PacketSchema.extends({});
  shell.tag = tag;
  shell.message = id;
  shell.body = body || {};
  shell.stream = stacks.Stream.make();
  shell.emit = stacks.funcs.bindByPass(shell.stream.emit,shell.stream);
  shell.endData = stacks.funcs.bindByPass(shell.stream.endData,shell.stream);
  shell.uuid = stacks.Util.guid();
  shell.toString = function(){ return [this.message,this.body].join(':'); };
  if(shell.body && stacks.valids.not.exists(shell.body.chUID)){
    shell.body.chUID = stacks.Util.guid();
  }
  return shell;
};

Packets.isPacket = function(p){
 if(p.cid && p.cid == packets) return true;
 return false;
};

Packets.isTask = function(p){
 if(Packets.isPacket(p) && p.tag == tasks) return true;
 return false;
};

Packets.isReply = function(p){
 if(Packets.isPacket(p) && p.tag == replies) return true;
 return false;
};

Packets.Task = function(id,body){
  return Packets(id,tasks,body);
};

Packets.Reply = function(id,body){
  return Packets(id,replies,body);
};

var Store = exports.Store = stacks.FunctionStore.extends({
  register: function(){ return this.add.apply(this,arguments); },
  unregister: function(){ return this.remove.apply(this,arguments); },
});

var SelectedChannel = exports.SelectedChannel = stacks.FilteredChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isPacket(f)) return;
      return next();
    });
  },
  mutate: function(fn){
    this.mutts.add(fn);
  },
  unmutate: function(fn){
    this.mutts.remove(fn);
  },
});

var TaskChannel = exports.TaskChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isTask(f)) return;
      return next();
    });
  }
});

var ReplyChannel = exports.ReplyChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isReply(f)) return;
      return next();
    });
  }
});

var PSMeta = { task: true, reply: true};
var PackStream = exports.PackStream = stacks.Class({
  init: function(ids,picker,mets){
    stacks.Asserted(stacks.valids.isObject(ids),'first agrument must be an object');
    stacks.Asserted(stacks.valids.exists(ids['task']),ids+' must have a "task" attribute');
    stacks.Asserted(stacks.valids.exists(ids['reply']),ids+' must have a "reply" attribute');
    var meta = stacks.Util.extends({},PSMeta,mets);
    this.packets = stacks.Stream.make();
    if(meta.task){
      this.tasks = TaskChannel.make(ids.task,picker);
      this.packets.stream(this.tasks);
    }
    if(meta.reply){
      this.replies = ReplyChannel.make(ids.reply,picker);
      this.packets.stream(this.replies);
    }
  },
  mutts: function(){
    return this.packets.mutts;
  },
  emit: function(f){
    if(!Packets.isPacket(f)) return;
    return this.packets.emit(f);
  },
  stream: function(sm){
    return this.packets.stream(sm);
  },
  unstream: function(sm){
    return this.packets.unstream(sm);
  },
  streamTask: function(sm){
    return this.tasks.stream(sm);
  },
  unstreamTask: function(sm){
    return this.tasks.unstream(sm);
  },
  streamReplies: function(sm){
    return this.replies.stream(sm);
  },
  unstreamReplies: function(sm){
    return this.replies.unstream(sm);
  },
});

var Plug = exports.Plug = stacks.Configurable.extends({
  init: function(id,gid,mapc){
    this.$super();
    stacks.Asserted(stacks.valids.isString(id),"first argument must be a string");
    var fx = stacks.funcs.always(true);
    this.chaMap = stacks.funcs.extends({ task: id, reply: fx },mapc);
    this.channels = PackStream.make({task: this.chaMap.task, reply: this.chaMap.reply });
    this.points = Store.make('plugPoints',stacks.funcs.identity);
    this.internalChannels = Store.make('plugInternalChannels',stacks.funcs.identity);
    this.id = id;
    this.gid = gid;
    this.configs.add('contract',id);
    this.configs.add('id',id);
    this.configs.add('gid',gid);

    var plate = null,bindfs,bindns;

    this.$secure('dispatch',function (t) {
      this.channels.emit(t);
    });

    this.isAttached = this.$closure(function(){
      return plate != null;
    });

    this.attachPlate = this.$closure(function(pl){
      if(this.isAttached() || !Plate.isInstance(pl)) return;
      plate = pl;
      bindfs = this.channels.replies.stream(plate.channels.packets);
      bindns = plate.channels.tasks.stream(this.channels.packets);
    });

    this.detachPlate = this.$closure(function(){
      bindfs.unstream();
      bindns.unstream();
      plate = bind = null;
    });

    this.dispatchReplies = this.$closure(function(f){
      if(!this.isAttached()) return;
      this.channels.replies.emit(f);
    });
    this.dispatchTasks = this.$closure(function(f){
      if(!this.isAttached()) return;
      plate.dispatch(f);
    });
  },
  replies: function(f){
    if(f) return this.getInternal(f);
    return this.channels.replies;
  },
  tasks: function(f){
    if(f) return this.getInternal(f);
    return this.channels.tasks;
  },
  useInternalTask: function(id,tag,picker){
    stacks.Asserted(arguments.length  > 0,'please supply the id, tag for the channel');
    if(arguments.length === 1)
      stacks.Asserted(stacks.valids.isString(id),'key for the channel must be a string')
    if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
    stacks.Asserted(!this.internalChannels.has(id),'id "'+id+'" is already in use');
    var tk = TaskChannel.make(tag,picker);
    this.internalChannels.add(id,tk);
    this.channels.stream(tk);
    return tk;
  },
  useInternalReply: function(id,tag,picker){
    stacks.Asserted(arguments.length >  0,'please supply the id, tag for the channel');
    if(arguments.length === 1)
      stacks.Asserted(stacks.valids.isString(id),'key for the channel must be a string')
    if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
    stacks.Asserted(!this.internalChannels.has(id),'id "'+id+'" is already in use');
    var tk = ReplyChannel.make(tag,picker);
    this.internalChannels.add(id,tk);
    this.channels.stream(tk);
    return tk;
  },
  getInternal: function(id){
    if(!this.internalChannels.has(id)) return;
    return this.internalChannels.Q(id);
  },
  point: function(alias){
    return this.points.Q(alias);
  },
  attachPoint: function(fn,filter,alias,k){
    if(alias && this.points.has(alias)) return;
    var pt = PlugPoint(fn,filter,k)(this);
    if(stacks.valids.notExists(alias)) stacks.Util.pusher(this.points.registry,pt);
    else this.points.add(alias,pt);
    return pt;
  },
  detachPoint: function(item){
    if(stacks.valids.isString(item) && this.points.has(item)){
      var pt = this.points.Q(item);
      if(stacks.valids.isFunction(pt.close)) pt.close();
      return pt;
    };
    if(stacks.valids.isObject(item)){
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          return fn(true);
        }
      });
      return item;
    }
  },
  Task:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Task(id,body);
    self.dispatchTasks(mesg);
    return mesg;
  },
  Reply:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Reply(id,body);
    self.dispatchReplies(mesg);
    return mesg;
  },
});

var Plate = exports.Plate = stacks.Configurable.extends({
  init: function(id,mapc) {
    this.$super();
    this.id = id;
    var fx = stacks.funcs.always(true);
    this.chaMap = stacks.funcs.extends({ task: fx, reply: fx },mapc);
    this.channels = PackStream.make({ reply: this.chaMap.reply, task: this.chaMap.task });
    this.points = Store.make('platePoints',stacks.funcs.identity);

    this.configs.add('contract',id);
    this.configs.add('id',id);
    var self = this;
    this.$secure('dispatch',function(f){
      this.channels.emit(f);
    });
  },
  point: function(alias){
    return this.points.Q(alias);
  },
  replies: function(f){
    // if(f) return this.getInternal(f);
    return this.channels.replies;
  },
  tasks: function(f){
    // if(f) return this.getInternal(f);
    return this.channels.tasks;
  },
  attachPoint: function(fn,filter,alias,k){
    if(alias && this.points.has(alias)) return;
    var pt = PlatePoint(fn,filter,k)(this);
    if(stacks.valids.notExists(alias)) stacks.Util.pusher(this.points.registry,pt);
    else this.points.add(alias,pt);
    return pt;
  },
  detachPoint: function(item){
    if(stacks.valids.isString(item) && this.points.has(item)){
      var pt = this.points.Q(item);
      if(stacks.valids.isFunction(pt.close)) pt.close();
      return pt;
    };
    if(stacks.valids.isObject(item)){
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          return fn(true);
        }
      });
      return item;
    }
  },
  plug: function(id){
    var pl =  Plug.make(id);
    pl.attachPlate(this);
    return pl;
  },
  plugQueue: function(){
    return new PlugQueue(this);
  },
  Task:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Task(id,body);
    self.dispatch(mesg);
    return mesg;
  },
  Reply:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Reply(id,body);
    self.dispatch(mesg);
    return mesg;
  },
  watch: function(uuid){
    var channel = new channels.SelectedChannel(uuid, MessagePicker);
    this.channel.subscriber = this.channels.stream(channel);
    return channel;
  },
  // task: function (uuid,id,body) {
    // var task = this.watch(uuid);
    // task.task = this.disptachTask(id,uuid,data);
    // return task;
  // },
});

var PlugQueue = exports.PlugQueue = stacks.Class({
  init: function(pl){
    stacks.Asserted(stacks.valids.isInstanceOf(pl,Plate),"argument must be an instance of plate");
    this.plate = pl;
    this.typeList = {};
    this.wq = stacks.WorkQueue();
    this.active = stacks.Switch();

    this.onDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
    this.onDoneOnce = stacks.funcs.bind(this.wq.done.addOnce,this.wq.done);
    this.offDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
  },
  peek: function(fn){
    this.wq.queue(fn);
  },
  queue: function(name,uuid){
    var self = this,
    guid = uuid || [name,stacks.Util.guid()].join(':'),
    chan = this.plate.watch(guid);
    chan.__guid = guid;

    if(this.typeList[guid]) return guid;

    this.typeList[guid] = ({
      'plug':name,
      'uuid': guid,
      'index': this.typeList.length,
      'watch':chan,
      'fn': stacks.funcs.bind(function(f){
        return this.plate.dispatchMessage(name,guid,f);
      },self)
    });

    return chan;
  },
  unqueue: function(pl){
    if(!this.has(pl)) return null;
    this.typeList[pl] = null;
  },
  has: function(n){
    return !!this.typeList[n];
  },
  __pack: function(){
    var self = this,e,m;
    for(m in this.typeList){
      e = this.typeList[m];
      if(stacks.Valids.notExists(e)) return;
      var plug = e['plug'],fn = e['fn'], chan = e['watch'];
      chan.once(function(f){ self.emit(f); });
      self.wq.queue(fn);
    };
    self.wq.queue(function(f){
      self.active.off();
    });
  },
  emit: function(f){
    if(!this.active.isOn()) this.__pack();
    this.active.on();
    return this.wq.emit(f);
  }
});

var PlugPoint = exports.PlugPoint = function(fx,filter,picker){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plug.isType(src)) return;

    var stm = stacks.Stream.make();
    var contract = stacks.Contract(filter || "*",picker || MessagePicker);
    var handle = this.bind(function(r){
      return fn.call(this,r,stm);
    });
    var contractHandle = stacks.funcs.bind(function(f){
      return this.interogate(f);
    },contract);

    contract.onPass(handle);
    src.channels.replies.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plug.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('close',function(){
      src.channels.replies.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plug',function(plug){
      if(!Plug.isType(plug)) return;
      this.stream(plug.channels.packets);
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('Task',function(n,b){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      var t = Packets.Task(n,b);
      stm.emit(f);
      return t;
    });

    this.secure('Reply',function(n,b){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      var t = Packets.Reply(n,b);
      stm.emit(f);
      return t;
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var PlatePoint = exports.PlatePoint = function(fx,filter,picker){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plate.isType(src)) return;

    var stm = stacks.Stream.make();
    var contract = stacks.Contract(filter || "*",picker || MessagePicker);
    var handle = this.bind(function(r){
      return fn.call(this,r,stm);
    });
    var contractHandle = stacks.funcs.bind(function(f){
      return this.interogate(f);
    },contract);

    contract.onPass(handle);
    src.channels.packets.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plate.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('Task',function(n,b){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      var t = Packets.Task(n,b);
      stm.emit(f);
      return t;
    });

    this.secure('Reply',function(n,b){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      var t = Packets.Reply(n,b);
      stm.emit(f);
      return t;
    });

    this.secure('close',function(){
      src.channels.packets.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var PlugStore = exports.PlugStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid,fx){
      var rest = stacks.enums.rest(arguments);
      var plug = Plug.make.apply(Plug,rest);
      fn.call(plug);
      return plug;
    });
  }
});

var AdapterStore = exports.AdapterStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid,fx){
      var rest = stacks.enums.rest(arguments);
      var ad = Adapters.apply(null,rest);
      fn.call(ad);
      return ad;
    });
  }
});

var ComposeStore = exports.ComposeStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn){
      var rest = stacks.enums.rest(arguments);
      var apt = Compose.make.apply(Compose,rest);
      fn.call(apt);
      return apt;
    });
  }
})

var Compose = exports.Compose = stacks.Configurable.extends({
  init: function(id,rack,net){
    stacks.Asserted(stacks.valids.isString(id),'id must be a string value');
    this.$super();
    this.id = id;
    this.rack = rack;
    this.network = net;
    // this.rack = rack;
    this.plate = Plate.make(id);
    this.plugs = stacks.Storage.make();
    // this.adapters = stacks.Storage.make();
    // this.plugPoints = stacks.Storage.make();
    // this.platePoints = stacks.Storage.make();

    //added plate bindings
    this.dispatch =  this.plate.dispatch;
    this.watch = this.plate.$closure(this.plate.watch);
    this.tasks = this.plate.$closure(this.plate.tasks);
    this.replies = this.plate.$closure(this.plate.replies);
  },
  use: function(plug,gid){
    stacks.Asserted(Plug.isInstance(plug),'first argument is required to be a plug instance');
    if(!this.plugs.has(gid || plug.GUUID)){
      this.plugs.add(gid || plug.GUUID,plug);
      plug.attachPlate(this.plate);
    }
    return this;
  },
  get: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugs.Q(gid);
  },
  Task: function(){
    return this.plate.Task.apply(this.plate,arguments);
  },
  Reply: function(){
    return this.plate.Reply.apply(this.plate,arguments);
  },
  queue: function(){
    return this.plate.plugQueue();
  },
});

var Adapters = exports.Adapters = function(){
  var dist = stacks.Distributors();
  var mux = stacks.Middleware(_.funcs.bind(_.funcs.bind(dist.distribute,dist)));
  var fx = _.funcs.bind(mux.emit,mux);
  var apt = { mux: mux, rack: dist, };

  stacks.funcs.selfReturn(apt,'from',function(){
    stacks.Asserted(SelectedChannel.isType(chan),'argument must be a channel instance');
    this.channel = chan;
    this.channel.on(fx);
  });

  stacks.funcs.selfReturn(apt,'detach',function(){
    this.channel.off(fx);
    this.channel = null;
  });

  stacks.funcs.selfReturn(apt,'muxate',function(fx){
    mux.add(fx);
  });

  stacks.funcs.selfReturn(apt,'out',function(){
    dist.add(fn);
  });

  stacks.funcs.selfReturn(apt,'outOnce',function(){
    dist.addOnce(fn);
  });

  stacks.funcs.selfReturn(apt,'unOut',function(){
    dist.remove(fn);
  });

  return apt;
};

var Mutators = exports.Mutators = function(fx){
  var channels = [], freed = [];
  return {
    bind: function(chan){
      if(this.has(chan)) return;
      chan.mutate(fx);
      var free = freed.pop();
      if(free) channels[free] = chan;
      else channels.push(chan);
    },
    unbind: function(chan){
      if(!this.has(chan)) return;
      chan.unmutate(fx);
      var ind = this.index(chan);
      channels[ind] = null;
      freed.push(ind);
    },
    unbindAll: function(exc){
      stacks.enums.each(channels,function(e){
        if(exc && e === exc) return;
        this.unbind(e);
      },null,this);
    },
    has: function(chan){
      return this.index(chan) !== -1;
    },
    index: function(chan){
      return channels.indexOf(chan);
    }
  }
};

var ema = [];
var Network = exports.Network = stacks.Configurable.extends({
  init: function(id,rack,fn){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
    // this.inBus = SelectedChannel.make(_.funcs.always(true));
    // this.outBus = SelectedChannel.make(_.funcs.always(true));
    this.composed = Store.make('NetworkComposers');

    var callable = stacks.valids.isFunction(rack) ? rack : fn;

    this.rack = (callable !== rack && RackSpace.isInstance(rack) ? rack : RackSpace.make('networkRack'));

    if(stacks.valids.isFunction(callable)) callable.call(this);
  },
  use: function(addr,id){
    stacks.Asserted(!this.has(id),stacks.Util.String(' ',id,'already attached!'));
    var cr = this.Resource.apply(this.rack,arguments);
    this.composed.add(id,cr);
    return cr;
  },
  crate: function(f){
    if(stacks.valids.isString(f)) return this.rack.new.apply(this.rack,arguments);
    return this.rack.rack.apply(this.rack,arguments);
  },
  uncrate: function(){ return this.rack.unrack.apply(this.rack,arguments); },
  hasCrate: function(){ return this.rack.has.apply(this.rack,arguments); },
  get: function(id){
    return this.composed.get(id);
  },
  remove: function(id){
    return this.composed.remove(id);
  },
  has: function(comp){
    if(Compose.isInstance(comp) && comp._nid){
      this.composed.has(comp._nid);
    }
    return this.composed.has(comp);
  },
  getResource: function(){
    var cr = this.rack.getResource.apply(this.rack,arguments);
    return cr;
  },
  Resource: function(){
    return this.resource.apply(this,arguments);
  }
});

var RackSpace = exports.RackSpace = stacks.Configurable.extends({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
    this.racks = stacks.Storage.make('rackspace');
  },
  has: function(ns){
    return this.racks.has(ns);
  },
  ns: function(ns){
    if(!this.has(ns)) return;
    return this.racks.get(ns);
  },
  new: function(id){
    stacks.Asserted(stacks.valids.isString(id),'first args must be a string');
    if(this.has(id)) return this.ns(id);
    return this.racks.add(id,Rack.make(id));
  },
  rack: function(rack){
    stacks.Asserted(Rack.isInstance(rack),'first args must be a Rack instance');
    if(this.racks.has(rack.id)) return;
    return this.racks.add(rack.id,rack);
  },
  unrack: function(rack){
    if(Rack.isInstance(rack)){
      return this.racks.remove(rack.id)
    }
    if(stack.valids.isString(rack)){
      return this.racks.remove(id);
    }
    return;
  },
  resource: function(addr){
    stacks.Asserted(stacks.valids.isString(addr),'first argument must be a string with format: {rack}/{type}/{id}');
    var rest = stacks.enums.rest(arguments);

    var paths = addr.split('/');
    stacks.Asserted(paths.length >= 3,'address for type and id is incorrect {rack}/{type}/id!');

    var tr = stacks.enums.rest(paths), rack = paths[0];
    stacks.Asserted(tr.length >= 2,'sub-address for type and id is incorrect {type}/{id}!');

    if(!this.has(rack)) return;

    var r = this.ns(rack), cr = r.resource.apply(r,tr.concat(rest));
    cr.track = rest;
    return cr;
  },
  getResource: function(addr){
    stacks.Asserted(stacks.valids.isString(addr),'first argument must be a string with format: {rack}/{type}/{id}');
    var rest = stacks.enums.rest(arguments);

    var paths = addr.split('/');
    stacks.Asserted(paths.length >= 3,'address for type and id is incorrect {rack}/{type}/id!');

    var tr = stacks.enums.rest(paths), rack = paths[0];
    stacks.Asserted(tr.length >= 2,'sub-address for type and id is incorrect {type}/{id}!');

    if(!this.has(rack)) return;

    var r = this.ns(rack), cr = r.getResource.apply(r,tr.concat(rest));
    cr.track = rest;
    return cr;
  }
});

var Rack = exports.Rack = stacks.Configurable.extends({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
    this.composed = ComposeStore.make("Composers");
    this.adapters = AdapterStore.make("plugs");
    this.plugs = PlugStore.make("plugs");
    this.plugPoints = Store.make("plugPoints",stacks.funcs.identity);
    this.platePoints = Store.make("platePoints",stacks.funcs.identity);
    this.mutators = Store.make("MutatorStore",stacks.funcs.identity);
  },
  resource: function(){
    var res,
        type = stacks.enums.first(arguments),
        name = stacks.enums.second(arguments),
        rest = stacks.enums.nthRest(arguments,2);

    var args = [name].concat(rest);
    switch(type){
      case 'adapters':
        res = this.Adapter.apply(this,args);
        break;
      case 'plugs':
        res = this.Plug.apply(this,args);
        break;
      case 'plugpoint':
        res = this.PlugPoint.apply(this,args);
        break;
      case 'platepoint':
        res = this.PlatePoint.apply(this,args);
        break;
      case 'mutator':
        res = this.Mutator.apply(this,args);
        break;
      case 'compose':
        res = this.Compose.apply(this,args);
        break;
    }

    return res;
  },
  getResource: function(){
    var res,
        type = stacks.enums.first(arguments),
        name = stacks.enums.second(arguments),
        rest = stacks.enums.nthRest(arguments,2);

    var args = [name].concat(rest);

    switch(type){
      case 'adapters':
        res = this.getAdapter.apply(this,args);
        break;
      case 'plugs':
        res = this.getPlug.apply(this,args);
        break;
      case 'plugpoint':
        res = this.getPlugPoint.apply(this,args);
        break;
      case 'platepoint':
        res = this.getPlatePoint.apply(this,args);
        break;
      case 'mutator':
        res = this.getMutator.apply(this,args);
        break;
      case 'compose':
        res = this.getCompose.apply(this,args);
        break;
    }

    return res;
  },
  hasCompose: function(id){
    return this.composed.has(id);
  },
  hasPlug: function(id){
    return this.plugs.has(id);
  },
  hasMutator: function(id){
    return this.mutators.has(id);
  },
  hasAdapter: function(id){
    return this.adapters.has(id);
  },
  hasPlugPoint: function(id){
    return this.plugPoints.has(id);
  },
  hasPlatePoints: function(id){
    return this.platePoints.has(id);
  },
  Plug: function(id){
    return this.plugs.Q.apply(this.plugs,arguments);
  },
  Adapter: function(id){
    return this.adapters.Q.apply(this.plugs,arguments);
  },
  Mutator: function(id){
    return this.mutators.Q.apply(this.mutators,arguments);
  },
  PlugPoint: function(id){
    return this.plugPoint.Q.apply(this.plugPoint,arguments);
  },
  PlatePoint: function(id){
    return this.platePoint.Q.apply(this.platePoint,arguments);
  },
  Compose: function(id,com){
    return this.composed.Q.apply(this.composed,arguments);
  },
  getPlug: function(id){
    return this.plugs.get.apply(this.plugs,arguments);
  },
  getAdapter: function(id){
    return this.adapters.get.apply(this.plugs,arguments);
  },
  getMutator: function(id){
    return this.mutators.get.apply(this.mutators,arguments);
  },
  getPlugPoint: function(id){
    return this.plugPoint.get.apply(this.plugPoint,arguments);
  },
  getPlatePoint: function(id){
    return this.platePoint.get.apply(this.platePoint,arguments);
  },
  getCompose: function(id,com){
    return this.composed.get.apply(this.composed,arguments);
  },
  registerPlug: function(){
    return this.plugs.register.apply(this.plugs,arguments);
  },
  registerPlugPoint: function(){
    return this.plugPoints.register.apply(this.plugPoints,arguments);
  },
  registerPlatePoint: function(){
    return this.platePoints.register.apply(this.platePoints,arguments);
  },
  registerCompose: function(){
    return this.composed.register.apply(this.composed,arguments);
  },
  registerAdapter: function(){
    return this.adapters.register.apply(this.adapters,arguments);
  },
  registerMutator: function(id,fn){
    return this.mutators.register(id,Mutators(fn));
  },
});
