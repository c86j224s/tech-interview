#if canImport(UIKit)
import UIKit

final class ConflictViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let box = UIView()
        box.translatesAutoresizingMaskIntoConstraints = false
        box.accessibilityIdentifier = "conflict-box"
        view.addSubview(box)

        let width = box.widthAnchor.constraint(equalToConstant: 100)
        width.identifier = "box-width-100"
        let minimumWidth = box.widthAnchor.constraint(greaterThanOrEqualToConstant: 240)
        minimumWidth.identifier = "box-minimum-width-240"

        NSLayoutConstraint.activate([
            box.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            box.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            width,
            minimumWidth
        ])
    }
}

let controller = ConflictViewController()
controller.loadViewIfNeeded()
controller.view.layoutIfNeeded()
print("NOT_RUN: UIKit conflict sample requires an iOS simulator or device")
#else
import Foundation
print("NOT_RUN: UIKit is unavailable in this macOS CLI target")
#endif
