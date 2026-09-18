import Foundation

final class Ledger {
    var entries: [String]

    init(seed: String) {
        self.entries = [seed]
        print("Ledger.init: phase-1 storage ready, entries=\(entries.count)")
    }

    deinit {
        print("Ledger.deinit")
    }
}

final class ScreenModel {
    let ledger: Ledger
    weak var observer: ScreenModel?

    init(seed: String) {
        self.ledger = Ledger(seed: seed)
        print("ScreenModel.init: ledger assigned")
    }

    func append(_ value: String) {
        ledger.entries.append(value)
        print("append: \(value), entries=\(ledger.entries.count)")
    }

    deinit {
        print("ScreenModel.deinit")
    }
}

func runInitializationAndARCTrace() {
    print("-- strong ownership --")
    var model: ScreenModel? = ScreenModel(seed: "boot")
    model?.append("first")

    print("-- weak back-reference --")
    var observer: ScreenModel? = ScreenModel(seed: "observer")
    model?.observer = observer
    observer = nil
    print("observer released; model still reachable=\(model != nil)")

    print("-- releasing root --")
    model = nil
}

runInitializationAndARCTrace()
