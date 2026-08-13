import WidgetKit
import SwiftUI

@main
struct TahajjudWidgetBundle: WidgetBundle {
    var body: some Widget {
        TahajjudWidget()
        TahajjudDuaWidget()
        // Interactive Lock Screen counter — Button(intent:) requires iOS 17;
        // omitted entirely below that rather than shown non-interactive,
        // since a dhikr counter you can't tap defeats the point.
        if #available(iOS 17.0, *) {
            DhikrWidget()
        }
    }
}
