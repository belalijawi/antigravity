package com.tahajjudplus.app.widget

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.tahajjudplus.app.MainActivity
import com.tahajjudplus.app.R

private val SMALL = DpSize(110.dp, 110.dp)
private val MEDIUM = DpSize(250.dp, 110.dp)
private val LARGE = DpSize(250.dp, 250.dp)

class TahajjudGlanceWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val data = WidgetData.load(context)
        provideContent {
            GlanceTheme {
                TahajjudWidgetContent(data)
            }
        }
    }
}

class TahajjudGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TahajjudGlanceWidget()
}

@Composable
private fun TahajjudWidgetContent(data: WidgetData) {
    val size = LocalSize.current
    when {
        size.height >= LARGE.height -> LargeWidgetContent(data)
        size.width >= MEDIUM.width -> MediumWidgetContent(data)
        else -> SmallWidgetContent(data)
    }
}

@Composable
private fun WidgetRoot(backgroundRes: Int, content: @Composable () -> Unit) {
    val context = LocalContext.current
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ImageProvider(backgroundRes))
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
    ) {
        // Nebula glow accent, shifted toward the top-right — no blur available
        // on Android widgets (see widget_glow_circle.xml for the trade-off).
        Image(
            provider = ImageProvider(R.drawable.widget_glow_circle),
            contentDescription = null,
            modifier = GlanceModifier
                .width(140.dp)
                .height(140.dp)
                .padding(start = 60.dp),
        )
        content()
    }
}

@Composable
private fun SmallWidgetContent(data: WidgetData) {
    WidgetRoot(R.drawable.widget_gradient_bg) {
        Column(modifier = GlanceModifier.fillMaxSize().padding(14.dp)) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically,
            ) {
                Text(prayerEmoji(data.nextPrayer), style = TextStyle(fontSize = 20.sp))
                Spacer(modifier = GlanceModifier.defaultWeight())
                if (data.streak >= 3) {
                    Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                        Text("🔥", style = TextStyle(fontSize = 12.sp))
                        Text(
                            " ${data.streak}",
                            style = TextStyle(
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = ColorProvider(WidgetColors.accentAmber),
                            ),
                        )
                    }
                }
            }
            Spacer(modifier = GlanceModifier.height(6.dp))
            data.freshTahajjudStart()?.let { t ->
                Text(
                    "🌙 ${formatTime(t)}",
                    style = TextStyle(
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(WidgetColors.accentPurple),
                    ),
                )
                Spacer(modifier = GlanceModifier.height(4.dp))
            }
            Text(
                data.nextPrayer,
                style = TextStyle(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = ColorProvider(WidgetColors.textWhite),
                ),
            )
            Text(
                formatTime(data.nextPrayerTime),
                style = TextStyle(fontSize = 13.sp, color = ColorProvider(WidgetColors.textSlate)),
            )
            Text(
                "in ${countdownText(data.nextPrayerTime)}",
                style = TextStyle(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = ColorProvider(WidgetColors.accentCyan),
                ),
            )
        }
    }
}

@Composable
private fun MediumWidgetContent(data: WidgetData) {
    WidgetRoot(R.drawable.widget_gradient_bg) {
        Row(modifier = GlanceModifier.fillMaxSize().padding(16.dp)) {
            Column(modifier = GlanceModifier.defaultWeight().padding(start = 4.dp)) {
                Text(
                    "NEXT PRAYER",
                    style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textSlateDim)),
                )
                Text(
                    data.nextPrayer,
                    style = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite)),
                )
                Text(
                    formatTime(data.nextPrayerTime),
                    style = TextStyle(fontSize = 15.sp, color = ColorProvider(WidgetColors.textSlateLight)),
                )
                Text(
                    "in ${countdownText(data.nextPrayerTime)}",
                    style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentCyan)),
                )
                data.freshTahajjudStart()?.let { t ->
                    Spacer(modifier = GlanceModifier.height(4.dp))
                    Text(
                        "🌙 ${formatTime(t)} Tahajjud",
                        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentPurple)),
                    )
                }
            }
            Spacer(modifier = GlanceModifier.width(16.dp))
            val loggable = data.loggableNow()
            Column(
                modifier = GlanceModifier.width(80.dp)
                    .then(
                        if (loggable != null)
                            GlanceModifier.clickable(actionRunCallback<LogPrayerAction>(actionParametersOf(PrayerKeyParam to loggable)))
                        else GlanceModifier
                    ),
                horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
            ) {
                if (loggable != null) {
                    Text("✅", style = TextStyle(fontSize = 28.sp))
                    Text("Log", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentCyan)))
                } else if (data.streak > 0) {
                    Text("🔥", style = TextStyle(fontSize = 28.sp))
                    Text(
                        "${data.streak}",
                        style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentAmber)),
                    )
                    Text("nights", style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetColors.textSlate)))
                } else {
                    Text("🌙", style = TextStyle(fontSize = 28.sp))
                    Text("Start", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textSlate)))
                    Text("tonight", style = TextStyle(fontSize = 10.sp, color = ColorProvider(WidgetColors.textSlateDim)))
                }
            }
        }
    }
}

@Composable
private fun LargeWidgetContent(data: WidgetData) {
    val fresh = data.freshTahajjudStart()
    val nowSeconds = System.currentTimeMillis() / 1000
    val isGateOpen = fresh != null && nowSeconds >= fresh

    WidgetRoot(R.drawable.widget_gradient_bg_large) {
        Column(modifier = GlanceModifier.fillMaxSize().padding(18.dp)) {
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
                Text("🌙 ", style = TextStyle(fontSize = 17.sp))
                Text(
                    "Tahajjud+",
                    style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite)),
                )
            }
            Spacer(modifier = GlanceModifier.height(16.dp))

            // Tahajjud block
            Column(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(ColorProvider(if (isGateOpen) WidgetColors.cardIndigoOpen else WidgetColors.cardIndigoDeep))
                    .cornerRadius(16.dp)
                    .padding(14.dp),
            ) {
                Text(
                    if (isGateOpen) "🔓 GATE IS OPEN" else "WAKE FOR TAHAJJUD",
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(if (isGateOpen) WidgetColors.accentPurple else WidgetColors.textSlateDim),
                    ),
                )
                if (fresh != null) {
                    Text(
                        formatTime(fresh),
                        style = TextStyle(
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(if (isGateOpen) WidgetColors.accentPurple else WidgetColors.textWhite),
                        ),
                    )
                    Text(
                        if (isGateOpen) "The last third of the night has begun" else "in ${countdownText(fresh)}",
                        style = TextStyle(fontSize = 12.sp, color = ColorProvider(WidgetColors.accentPurple)),
                    )
                } else {
                    Text("Open the app to calculate", style = TextStyle(fontSize = 14.sp, color = ColorProvider(WidgetColors.textSlateDimmer)))
                }
            }

            Spacer(modifier = GlanceModifier.height(14.dp))

            // Next prayer row
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
                Text(prayerEmoji(data.nextPrayer), style = TextStyle(fontSize = 28.sp))
                Spacer(modifier = GlanceModifier.width(12.dp))
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text("NEXT PRAYER", style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textSlateDim)))
                    Text(data.nextPrayer, style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite)))
                }
                Column(horizontalAlignment = Alignment.Horizontal.End) {
                    Text(formatTime(data.nextPrayerTime), style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textSlateLight), textAlign = TextAlign.End))
                    Text("in ${countdownText(data.nextPrayerTime)}", style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentCyan), textAlign = TextAlign.End))
                }
            }

            Spacer(modifier = GlanceModifier.height(14.dp))

            // Streak row
            Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
                Text(if (data.streak > 0) "🔥" else "🌙", style = TextStyle(fontSize = 28.sp))
                Spacer(modifier = GlanceModifier.width(12.dp))
                Column(modifier = GlanceModifier.defaultWeight()) {
                    if (data.streak > 0) {
                        val nightsLabel = if (data.streak == 1) "night" else "nights"
                        Text("${data.streak} $nightsLabel", style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentAmber)))
                        Text("Tahajjud streak", style = TextStyle(fontSize = 11.sp, color = ColorProvider(WidgetColors.textSlate)))
                    } else {
                        Text("Start your streak", style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite)))
                        Text("Pray Tahajjud tonight", style = TextStyle(fontSize = 11.sp, color = ColorProvider(WidgetColors.textSlate)))
                    }
                }
                data.loggableNow()?.let { prayer ->
                    Box(
                        modifier = GlanceModifier
                            .background(ColorProvider(WidgetColors.accentCyan))
                            .cornerRadius(10.dp)
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .clickable(actionRunCallback<LogPrayerAction>(actionParametersOf(PrayerKeyParam to prayer))),
                    ) {
                        Text(
                            "Log ${prayer.replaceFirstChar { it.uppercase() }}",
                            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.bgTop)),
                        )
                    }
                }
            }
        }
    }
}

private fun formatTime(epochSeconds: Long): String {
    val date = java.util.Date(epochSeconds * 1000)
    val fmt = java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
    return fmt.format(date)
}
