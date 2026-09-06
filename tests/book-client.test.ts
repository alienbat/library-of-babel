import assert from 'node:assert/strict';
import test from 'node:test';
import {createBookClient} from '../lib/game/book-client.ts';

void test('worker failure retains the original diagnosis on later book requests',async(t)=>{
  class WorkerStub {
    static instance:WorkerStub;
    onerror?: (event:{message:string})=>void;
    onmessageerror?:()=>void;
    constructor(){WorkerStub.instance=this;}
    postMessage(){}
    terminate(){}
  }
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:WorkerStub});
  t.mock.method(console,'error',()=>{});
  const client=createBookClient(()=>{},()=>{});
  try{
    const book={level:0,bay:1,side:1 as const,row:0,book:0};
    const pending=client.page(book,0);
    WorkerStub.instance.onerror!({message:'Example engine failure'});
    await assert.rejects(pending,/Example engine failure/);
    await assert.rejects(client.page(book,1),/Example engine failure/);
  }finally{
    client.dispose();
    if(previous)Object.defineProperty(globalThis,'Worker',previous);else Reflect.deleteProperty(globalThis,'Worker');
  }
});
