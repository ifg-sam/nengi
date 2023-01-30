import EDictionary from './EDictionary';
import IdPool from './IdPool';
import IEntity from '../common/IEntity';
declare class LocalState {
    idPool: IdPool;
    sources: Map<number, Set<number>>;
    parents: Map<number, Set<number>>;
    _entities: EDictionary;
    constructor();
    addChild(parent: IEntity, child: IEntity): void;
    removeChild(parent: IEntity, child: IEntity): void;
    registerEntity(entity: IEntity, sourceId: number): number;
    unregisterEntity(entity: IEntity, sourceId: number): void;
    getByNid(nid: number): IEntity;
}
export default LocalState;
