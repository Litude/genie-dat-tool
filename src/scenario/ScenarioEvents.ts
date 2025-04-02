import BufferReader from "../BufferReader";
import { ObjectId, PlayerScenarioSlot, PrototypeId } from "../database/Types";
import { Point3D } from "../geometry/Point";
import {
  asFloat32,
  asInt16,
  Float32,
  Int16,
  UInt16,
  UInt8,
} from "../ts/base-types";

export type EventObjectId = Int16 & { __type: "EventObjectId" };

export interface ScenarioEvent {
  eventTime: Float32;
  eventType: UInt8;
  objectPrototypeId: PrototypeId<Int16>;
  playerSlot: PlayerScenarioSlot<UInt8>;
  position: Point3D<Float32>;
  taskType: UInt16;
  sourceObjectId: EventObjectId | ObjectId<Int16>;
  sourcePlayerSlot: PlayerScenarioSlot<Int16>;
  targetObjectId: EventObjectId | ObjectId<Int16>;
  targetPlayerSlot: PlayerScenarioSlot<Int16>;
}

export class ScenarioEvents {
  eventCount: Int16 = asInt16(0);
  nextEventObjectId: EventObjectId = asInt16<EventObjectId>(0);
  updateTime: Float32 = asFloat32(-1);
  events: ScenarioEvent[] = [];

  static readFromBuffer(buffer: BufferReader) {
    const scenarioEvents = new ScenarioEvents();
    scenarioEvents.eventCount = buffer.readInt16();
    scenarioEvents.nextEventObjectId = buffer.readInt16<EventObjectId>();
    scenarioEvents.updateTime = buffer.readFloat32();

    for (let i = 0; i < scenarioEvents.eventCount; ++i) {
      const eventTime = buffer.readFloat32();
      const eventType = buffer.readUInt8();
      const objectPrototypeId = buffer.readInt16<PrototypeId<Int16>>();
      const playerSlot = buffer.readUInt8<PlayerScenarioSlot<UInt8>>();
      const position: Point3D<Float32> = {
        x: buffer.readFloat32(),
        y: buffer.readFloat32(),
        z: buffer.readFloat32(),
      };
      const taskType = buffer.readUInt16();
      const sourceObjectId = buffer.readInt16<
        EventObjectId | PrototypeId<Int16>
      >();
      const sourcePlayerSlot = buffer.readInt16<PlayerScenarioSlot<Int16>>();
      const targetObjectId = buffer.readInt16<
        EventObjectId | PrototypeId<Int16>
      >();
      const targetPlayerSlot = buffer.readInt16<PlayerScenarioSlot<Int16>>();
      scenarioEvents.events.push({
        eventTime,
        eventType,
        objectPrototypeId,
        playerSlot,
        position,
        taskType,
        sourceObjectId,
        sourcePlayerSlot,
        targetObjectId,
        targetPlayerSlot,
      });
    }

    return scenarioEvents;
  }
}
