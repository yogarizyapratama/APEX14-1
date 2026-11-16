export interface RelationDefinition {
  type: "hasMany" | "belongsTo";
  target: any; // Model instance or function () => Model
  foreignKey?: string;
  localKey?: string;
}

export interface HasManyOptions {
  foreignKey?: string;
  localKey?: string;
}

export interface BelongsToOptions {
  foreignKey?: string;
  localKey?: string;
}

export function hasMany(targetModel: any, options: HasManyOptions = {}): RelationDefinition {
  return {
    type: "hasMany",
    target: targetModel,
    foreignKey: options.foreignKey,
    localKey: options.localKey || "id"
  };
}

export function belongsTo(targetModel: any, options: BelongsToOptions = {}): RelationDefinition {
  return {
    type: "belongsTo",
    target: targetModel,
    foreignKey: options.foreignKey,
    localKey: options.localKey || "id"
  };
}
