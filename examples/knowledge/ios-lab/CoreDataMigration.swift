import Foundation
import CoreData

func model(version: Int) -> NSManagedObjectModel {
    let entity = NSEntityDescription()
    entity.name = "Record"
    entity.managedObjectClassName = "NSManagedObject"
    let name = NSAttributeDescription()
    name.name = "name"
    name.attributeType = .stringAttributeType
    name.isOptional = false
    entity.properties = [name]
    if version == 2 {
        let memo = NSAttributeDescription()
        memo.name = "memo"
        memo.attributeType = .stringAttributeType
        memo.isOptional = true
        entity.properties.append(memo)
    }
    let result = NSManagedObjectModel()
    result.entities = [entity]
    result.versionIdentifiers = ["v\(version)"]
    return result
}

let directory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = directory.appendingPathComponent("coredata-v1.sqlite")
let target = directory.appendingPathComponent("coredata-v2.sqlite")
let oldModel = model(version: 1)
let newModel = model(version: 2)
let sourceCoordinator = NSPersistentStoreCoordinator(managedObjectModel: oldModel)
let sourceStore = try sourceCoordinator.addPersistentStore(ofType: NSSQLiteStoreType,
    configurationName: nil, at: source, options: nil)
let context = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
context.persistentStoreCoordinator = sourceCoordinator
let record = NSEntityDescription.insertNewObject(forEntityName: "Record", into: context)
record.setValue("preserved", forKey: "name")
try context.save()
context.reset()
try sourceCoordinator.remove(sourceStore)

let mapping = try NSMappingModel.inferredMappingModel(forSourceModel: oldModel,
    destinationModel: newModel)
let migration = NSMigrationManager(sourceModel: oldModel, destinationModel: newModel)
try migration.migrateStore(from: source, sourceType: NSSQLiteStoreType, options: nil,
    with: mapping, toDestinationURL: target, destinationType: NSSQLiteStoreType,
    destinationOptions: nil)
let destinationCoordinator = NSPersistentStoreCoordinator(managedObjectModel: newModel)
let destinationStore = try destinationCoordinator.addPersistentStore(ofType: NSSQLiteStoreType,
    configurationName: nil, at: target, options: nil)
let resultContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
resultContext.persistentStoreCoordinator = destinationCoordinator
let records = try resultContext.fetch(NSFetchRequest<NSManagedObject>(entityName: "Record"))
precondition(records.count == 1)
precondition(records[0].value(forKey: "name") as? String == "preserved")
precondition(records[0].value(forKey: "memo") == nil)
resultContext.reset()
try destinationCoordinator.remove(destinationStore)
print("PASS Core Data inferred mapping: v1 row preserved, optional v2 attribute nil")
