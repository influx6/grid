var stacks = require("stackq");
var AllTrue = stacks.funcs.always(true);
var ema = [];
var PSMeta = { task: true, reply: true};
var MessagePicker = function(n){ return n['message']; };
var inNext = function(n,e){ return n(); };
var tasks = 0x24677B434A323;
var replies = 0x1874F43FF45;
var interpack = 0x1844A43CF72;
var extrapack = 0x2732B4372;
var packets = 0x1874F43FF45;


var PacketSchema = stacks.Schema({},{
    message: 'string',
    packets: 'stream',
    stream: 'function',
    tag: 'number',
    level: 'number',
    uuid: 'string',
    cid: packets,
    'origin?':'string',
  },{
    uuid:{
      maxWrite: 1,
    },
    origin:{
      maxWrite: 1,
    },
    stream:{
      maxWrite: 1,
    },
    packets:{
      maxWrite: 1,
    },
    cid:{
      copy: true,
    },
    tag:{
      maxWrite: 1,
    },
    level:{
      maxWrite: 1,
    },
    message:{
      maxWrite: 1,
    },
  },{
  stream: function(f,fn){
    return fn(stacks.Persisto.isInstance(f));
  }
});

var Packets = exports.Packets = function(id,tag,body,private){
  var shell = PacketSchema.extends({});
  // shell.level = intrapack;
  var locked = false;
  shell.private = private;
  shell.tag = tag;
  shell.message = id;
  shell.body = body || {};

  /*packet level-function-begin*/

  shell.lock = function(){ locked = true; };
  shell.locked = function(){ return locked; };
  shell.packets = stacks.Persisto.make();
  shell.emit = stacks.funcs.bindByPass(shell.packets.emit,shell.packets);
  shell.copy = stacks.funcs.bindByPass(shell.packets.copy,shell.packets);
  shell.link = stacks.funcs.bindByPass(shell.packets.link,shell.packets);
  shell.flood = stacks.funcs.bindByPass(shell.packets.flood,shell.packets);
  shell.end = stacks.funcs.bindByPass(shell.packets.end,shell.packets);
  shell.stream = stacks.funcs.bindByPass(shell.packets.stream,shell.packets);
  shell.close = stacks.funcs.bindByPass(shell.packets.close,shell.packets);

  /*packet level-function-end*/

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

Packets.isExtra = function(p){
 if(Packets.isPacket(p) && p.level == extrapack) return true;
 return false;
};

Packets.isReply = function(p){
 if(Packets.isPacket(p) && p.tag == replies) return true;
 return false;
};

Packets.Task = function(id,body,priv){
  var p = Packets(id,tasks,body,priv);
  p.level = interpack;
  return p;
};

Packets.Reply = function(id,body,priv){
  var p = Packets(id,replies,body,priv);
  p.level = interpack;
  return p;
};

Packets.iTask = function(id,body,priv){
  var p = Packets(id,tasks,body,priv);
  p.level = extrapack;
  return p;
};

Packets.iReply = function(id,body,priv){
  var p = Packets(id,replies,body,priv);
  p.level = extrapack;
  return p;
};

var Store = exports.Store = stacks.FunctionStore.extends({
  register: function(){ return this.add.apply(this,arguments); },
  unregister: function(){ return this.remove.apply(this,arguments); },
});

var SelectedChannel = exports.SelectedChannel = stacks.FilteredChannel.extends({
  init: function(id,picker,fx){
    this.$super(id,picker || MessagePicker);
    this.lockProxy = stacks.Proxy(function(f,next,end){
      if(!Packets.isPacket(f)) return;
      if(stacks.valids.isFunction(f.locked) && !!f.locked()) return;
      return next();
    });

    this.mutts.add(function(f,next,end){
      if(!Packets.isPacket(f)) return;
      return next();
    });

    if(stacks.valids.Function(fx)) fx.call(this);

    this.mutts.add(this.lockProxy.proxy);

    var bindings = {};

    this.bindOut = this.$bind(function(chan){
      if(!SelectedChannel.isType(chan) || stacks.valids.contains(bindings,chan.GUUID)) return;
      bindings[chan.GUUID] = {
         out: this.stream(chan),
         in: { unstream: function(){}}
      };
    });

    this.bindIn = this.$bind(function(chan){
      if(!SelectedChannel.isType(chan) || stacks.valids.contains(bindings,chan.GUUID)) return;
      bindings[chan.GUUID] = {
         in: chan.stream(this),
         out: { unstream: function(){}}
      };
    });

    this.unbind = this.$bind(function(chan){
      if(!SelectedChannel.isType(chan) || stacks.valids.not.contains(bindings,chan.GUUID)) return;
      var p = this.bindings[chan.GUUID];
      p.in.unstream(); p.out.unstream();
    });

    this.unbindAllChannel = this.$bind(function(chan){
      stacks.enums.each(bindings,function(e,i,o,fn){
        if(chan && i === chan.GUUID) return fn(null);
        e.in.unstream(); e.out.unstream();
        return fn(null);
      });
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
    this.$super(id,picker || MessagePicker,function(){
      this.mutts.add(function(f,next,end){
        if(!Packets.isTask(f)) return;
        return next();
      });
    });

    this.mutts.add(function(f,next,end){
      f.locked();
      return next();
    });
  }
});

var ReplyChannel = exports.ReplyChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker,function(){
      this.mutts.add(function(f,next,end){
        if(!Packets.isReply(f)) return;
        return next();
      });
    });
  }
});

var Plug = exports.Plug = stacks.Configurable.extends({
  init: function(id,gid,fn){
    this.$super();
    stacks.Asserted(stacks.valids.isString(id),"first argument must be a string");
    var bindings = [],network;

    this.points = Store.make('points',stacks.funcs.identity);
    this.internalTasks = Store.make('tasks',stacks.funcs.identity);
    this.internalReplies = Store.make('replies',stacks.funcs.identity);

    this.id = id;
    this.gid = gid;

    this.makeName = this.$bind(function(sn){
      if(stacks.valids.not.String(sn)){ return; }
      var m;
      if(stacks.valids.String(this.id)) m = this.id;
      else m = this.gid;
      return [m,sn].join('.');
    });

    this.channel = TaskChannel.make(id);
    this.replyChannel = ReplyChannel.make(stacks.funcs.always(true));

    this.channel.pause();
    this.replyChannel.pause();

    this.configs.add('id',id);
    this.configs.add('gid',gid);

    var plate = null,bind,bindrs;

    this.pub('boot');
    this.pub('networkAttached');
    this.pub('networkDetached');
    this.pub('attachPlate');
    this.pub('detachPlate');
    this.pub('release');

    this.boot = this.$bind(function(){
      this.emit('boot',true);
    });

    this.after('boot',this.$bind(function(){
      this.channel.resume();
      this.replyChannel.resume();
    }));

    this.isAttached = this.$closure(function(){
      return plate != null;
    });

    this.hasNetwork = this.$closure(function(){
      return network != null;
    });

    this.attachPlate = this.$closure(function(pl){
      if(this.isAttached() || !Plate.isInstance(pl)) return;
      bind = pl.channel.stream(this.channel);
      bindrs = this.replyChannel.stream(pl.channel);
      plate = pl;
      this.emit('attachPlate',pl);
      this.boot();
    });

    this.detachPlate = this.$closure(function(){
      this.emit('detachPlate',plate);
      if(this.isAttached()){
        bind.unstream();
        bindrs.unstream();
      }
      plate = bind = null;
      this.destoryBindings();
    });

    this.$secure('dispatch',function (t) {
      if(!this.isAttached()) return;
      plate.dispatch(t);
    });

    this.$secure('dispatchReply',function (t) {
      this.replyChannel.emit(t);
    });

    this.afterPlate = this.$closure(function(fn){
      if(!this.isAttached()){
        return this.afterOnce('attachPlate',this.$bind(function(f){
            return fn.call(this,plate);
        }));
      }
      return (stacks.valids.isFunction(fn) ? fn.call(this,plate) : null);
    });

    this.destoryBindings = this.$bind(function(){
      stacks.enums.each(bindings,function(e,i,o,fn){
        e.unstream();
        fn(null);
      },function(){
        bindings.length = 0;
      });
    });

    this.newTaskChannel= this.$bind(function(id,tag,picker){
      stacks.Asserted(arguments.length  > 0,'please supply the id, tag for the channel');
      if(arguments.length === 1)
        stacks.Asserted(stacks.valids.isString(id),'key for the channel must be a string')
      if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
      stacks.Asserted(!this.internalTasks.has(id),'id "'+id+'" is already in use');
      var tk = TaskChannel.make(tag,picker);
      this.internalTasks.add(id,tk);
      this.afterPlate(function(pl){
        var br = pl.channel.stream(tk);
        bindings.push(br);
      });
      return tk;
    });

    this.newReplyChannel= this.$bind(function(id,tag,picker){
      stacks.Asserted(arguments.length >  0,'please supply the id, tag for the channel');
      if(arguments.length === 1)
        stacks.Asserted(stacks.valids.isString(id),'key for the channel must be a string')
      if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
      stacks.Asserted(!this.internalReplies.has(id),'id "'+id+'" is already in use');
      var tk = ReplyChannel.make(tag,picker);
      this.internalReplies.add(id,tk);
      this.afterPlate(function(pl){
        var br = tk.stream(pl.channel)
        bindings.push(br);
      });
      return tk;
    });

    this.attachNetwork = this.$bind(function(net){
      if(!Network.isInstance(net) || this.hasNetwork()) return;
      network = net;
      this.emit('networkAttached',net);
      this.withNetwork(this.tasks(),this.replies());

    });

    this.detachNetwork = this.$bind(function(){
      if(!this.hasNetwork()) return;
      this.tasks().unbind(network.plate.channel);
      network = null;
      this.emit('networkDetached',net);
    });

    this.withNetwork = this.$bind(function(chan,xchan){
      if(!SelectedChannel.isType(chan)) return;

      this.afterOnce('networkAttached',function(net){
        if(network){
          network.bindIn(chan);
          network.bindOut(xchan);
        }
      });
      this.afterOnce('networkDetached',function(net){
        if(network){
          network.unbind(chan);
          network.unbind(xchan);
        }
      });
    });

    this.exposeNetwork = this.$bind(function(fx){
      if(stacks.valids.Function(fx)) fx.call(network);
      return network;
    });

    this.$rack(fn);
  },
  changeContract: function(n){
    this.channel.changeContract(n);
  },
  replies: function(f){
    if(f) return this.internalReplies.get(f);
    return this.replyChannel;
  },
  tasks: function(f){
    if(f) return this.internalTasks.get(f);
    return this.channel;
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
      this.points.remove(item);
      return pt;
    };
    if(stacks.valids.isObject(item)){
      var self = this;
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          self.points.remove(i);
          return fn(true);
        }
      });
      return item;
    }
  },
  detachAllPoint: function(){
    this.points.each(function(f,i,o,fn){
      if(stacks.valids.isFunction(f.close)) f.close();
      return fn(true);
    });
  },
  release: function(){
    this.detachPlate();
    this.emit('release',this);
  },
  close: function(){
    this.$super();
    this.emit('close',this);
    this.release();
    this.detachAllPoint();
  },
  Task:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Task(id,body,this.GUUID);
    self.dispatch(mesg);
    return mesg;
  },
  Reply:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Reply(id,body,this.GUUID);
    self.dispatchReply(mesg);
    return mesg;
  },
});

var Plate = exports.Plate = stacks.Configurable.extends({
  init: function(id) {
    var self = this;
    this.$super();
    this.id = id;
    this.configs.add('id',id);

    this.points = Store.make('points',stacks.funcs.identity);
    this.proxy = stacks.Proxy(function(){ return true; });
    this.channel = SelectedChannel.make(this.proxy.proxy);

    this.bindIn = stacks.funcs.bind(this.channel.bindIn,this.channel);
    this.bindOut = stacks.funcs.bind(this.channel.bindOut,this.channel);
    this.unbind = stacks.funcs.bind(this.channel.unbind,this.channel);

    this.pub('boot');
    this.pub('shutdown');

    this.boot = this.$bind(function(){
      this.emit('boot',true);
    });
    this.after('boot',this.$bind(function(){
      this.channel.resume();
    }));

    this.makeName = this.$bind(function(sn){
      if(stacks.valids.not.String(sn)){ return; }
      return [this.id,sn].join('.');
    });

    this.$secure('dispatch',function(f){
      if(Packets.isExtra(f)) return;
      f.origin = this.GUUID;
      this.channel.emit(f);
    });
  },
  changeContract: function(n){
    this.channel.changeContract(n);
  },
  share: function(plate){
    if(!Plate.isInstance(plate)) return;
    this.channel.bindIn(plate.channel);
  },
  unshare: function(plate){
    if(!Plate.isInstance(plate)) return;
    this.channel.unbind(plate.channel);
  },
  plug: function(id,gid,fn){
    return new Plug(id,gid,fn)
  },
  tasks: function(){ return this.channel; },
  hookProxy: function(c){
    c.Task = stacks.funcs.bind(this.Task,this);
    c.Reply = stacks.funcs.bind(this.Reply,this);
    c.watch = stacks.funcs.bind(this.watch,this);
    c.makeName = stacks.funcs.bind(this.makeName,this);
    c.switchFilter = stacks.funcs.bind(this.switchFilter,this);
    c.boot = stacks.funcs.bind(this.boot,this);
    c.plugQueue = stacks.funcs.bind(this.plugQueue,this);
    c.tasks = stacks.funcs.bind(this.tasks,this);
    c.dispatch = stacks.funcs.bind(this.dispatch,this);
    c.bindIn = stacks.funcs.bind(this.bindIn,this);
    c.bindOut = stacks.funcs.bind(this.bindOut,this);
    c.unbind = stacks.funcs.bind(this.unbind,this);
    c.share = stacks.funcs.bind(this.share,this);
    c.unshare = stacks.funcs.bind(this.unshare,this);
  },
  point: function(alias){
    return this.points.Q(alias);
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
      this.points.remove(item);
      return pt;
    };
    if(stacks.valids.isObject(item)){
      var self = this;
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          self.points.remove(i);
          return fn(true);
        }
      });
      return item;
    }
  },
  plugQueue: function(){
    return new PlugQueue(this);
  },
  Task:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Task(id,body,this.GUUID);
    self.dispatch(mesg);
    return mesg;
  },
  Reply:  function (id,body) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    stacks.Asserted(stacks.valids.exists(body),"body is required (body)");
    var self = this, mesg = Packets.Reply(id,body,this.GUUID);
    self.dispatch(mesg);
    return mesg;
  },
  watch: function(uuid){
    var channel = new channels.SelectedChannel(uuid, MessagePicker);
    this.channel.subscriber = this.channel.stream(channel);
    return channel;
  },
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
    src.replyChannel.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plug.isType(e)) return ff(null);
      stm.stream(e.channel.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('close',function(){
      src.replyChannel.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plug',function(plug){
      if(!Plug.isType(plug)) return;
      this.stream(plug.channel.packets);
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channel.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('mux',function(fn){
      stm.transformAsync(fn);
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

    this.secure('iTask',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.iTask(n,b,f);
    });

    this.secure('iReply',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.iReply(n,b,f);
    });

    this.secure('srcTask',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.Task(n,b,f);
    });

    this.secure('srcReply',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.Reply(n,b,f);
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
    src.channel.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plate.isType(e)) return ff(null);
      stm.stream(e.channel.packets);
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

    this.secure('iTask',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.iTask(n,b,f);
    });

    this.secure('iReply',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.iReply(n,b,f);
    });

    this.secure('srcTask',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.Task(n,b,f);
    });

    this.secure('srcReply',function(n,b,f){
      stacks.Asserted(stacks.valids.exists(n),"id is required (id)");
      stacks.Asserted(stacks.valids.exists(b),"body is required (body)");
      return src.Reply(n,b,f);
    });

    this.secure('mux',function(fn){
      stm.transformAsync(fn);
    });

    this.secure('close',function(){
      src.channel.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channel.packets);
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
    if(cr) cr.track = rest;
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
    if(cr) cr.track = rest;
    return cr;
  }
});

var Rack = exports.Rack = stacks.Configurable.extends({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
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
    }

    return res;
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
    return this.plugPoints.Q.apply(this.plugPoints,arguments);
  },
  PlatePoint: function(id){
    return this.platePoints.Q.apply(this.platePoints,arguments);
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
    return this.plugPoints.get.apply(this.plugPoints,arguments);
  },
  getPlatePoint: function(id){
    return this.platePoints.get.apply(this.platePoints,arguments);
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
  registerAdapter: function(){
    return this.adapters.register.apply(this.adapters,arguments);
  },
  registerMutator: function(id,fn){
    return this.mutators.register(id,Mutators(fn));
  },
});

var Network = exports.Network = stacks.Configurable.extends({
  init: function(id,rs,fn){
    if(stacks.valids.exists(rs) && stacks.valids.not.Function(rs)){
      stacks.Asserted(RackSpace.isInstance(rs),'supply a rackspace instance as second argument');
    }
    this.$super();
    this.id = id;
    this.rs = rs;
    this.plate = Plate.make(id);
    this.plugs = stacks.Storage.make();

    this.plate.hookProxy(this);

    this.$rack(rs || fn);
  },
  use: function(plug,gid){
    stacks.Asserted(Plug.isInstance(plug),'first argument is required to be a plug instance');
    if(!this.plugs.has(gid || plug.GUUID)){
      this.plugs.add(gid || plug.GUUID,plug);
      plug.gid = gid;
      plug.attachPlate(this.plate);
    }
    return this;
  },
  get: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugs.Q(gid);
  },
  remove: function(gid){
    if(!this.has(gid)) return;
    var pl = this.get(gid);
    pl.release();
    return pl;
  },
  destroy: function(gid){
    var f = this.remove(gid);
    if(f) f.close();
    return f;
  },
  has: function(id){
    return this.plugs.has(id);
  },
})
