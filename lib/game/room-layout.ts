/** Shared authoring/collision dimensions, in metres from the amenity bay origin. */
export const DORM={left:16,right:24,depth:6.3,doorLeft:18,doorRight:20,bathDoorStart:2.8,bathDoorEnd:4.0};
export const BATH_SHIFT=2;
export const ROOM_VOLUME={width:32,depth:6.5};
export const DORM_BEDS=[
  ...[17.2,19,20.8,22.6].map(x=>({x,depth:5.1,head:1})),
  ...[17.2,21,22.8].map(x=>({x,depth:1.7,head:-1})),
];
