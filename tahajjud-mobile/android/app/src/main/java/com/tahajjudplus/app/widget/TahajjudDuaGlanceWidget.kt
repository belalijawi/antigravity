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
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
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

private enum class DuaSize { SMALL, MEDIUM, LARGE }

class TahajjudDuaGlanceWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val dua = DuaWidgetData.load(context)
        provideContent {
            GlanceTheme {
                DuaWidgetContent(dua)
            }
        }
    }
}

class TahajjudDuaGlanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TahajjudDuaGlanceWidget()
}

@Composable
private fun DuaWidgetContent(dua: DuaWidgetData?) {
    val size = LocalSize.current
    val bucket = when {
        size.height >= LARGE.height -> DuaSize.LARGE
        size.width >= MEDIUM.width -> DuaSize.MEDIUM
        else -> DuaSize.SMALL
    }

    val context = LocalContext.current
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ImageProvider(R.drawable.widget_gradient_bg))
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java))),
    ) {
        Image(
            provider = ImageProvider(R.drawable.widget_glow_circle),
            contentDescription = null,
            modifier = GlanceModifier.width(140.dp).height(140.dp).padding(start = 70.dp),
        )
        if (dua != null) {
            DuaContent(dua, bucket)
        } else {
            DuaPlaceholder()
        }
    }
}

@Composable
private fun DuaContent(dua: DuaWidgetData, bucket: DuaSize) {
    val padding = if (bucket == DuaSize.SMALL) 12.dp else 16.dp
    val titleSize = if (bucket == DuaSize.SMALL) 11.sp else 13.sp
    val bodySize = if (bucket == DuaSize.SMALL) 11.sp else 12.sp
    val arabicSize = if (bucket == DuaSize.LARGE) 24.sp else 17.sp

    Column(modifier = GlanceModifier.fillMaxSize().padding(padding)) {
        Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
            Text("🤲 ", style = TextStyle(fontSize = titleSize))
            Text(
                dua.title,
                maxLines = 1,
                style = TextStyle(fontSize = titleSize, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.accentPurple)),
            )
        }
        if (bucket != DuaSize.SMALL && dua.arabic.isNotEmpty()) {
            Spacer(modifier = GlanceModifier.height(6.dp))
            Text(
                dua.arabic,
                maxLines = if (bucket == DuaSize.LARGE) 6 else 2,
                style = TextStyle(fontSize = arabicSize, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite), textAlign = TextAlign.End),
            )
        }
        if (dua.translation.isNotEmpty()) {
            Spacer(modifier = GlanceModifier.height(if (bucket == DuaSize.SMALL) 4.dp else 8.dp))
            Text(
                dua.translation,
                maxLines = when (bucket) {
                    DuaSize.LARGE -> 8
                    DuaSize.SMALL -> 6
                    DuaSize.MEDIUM -> 3
                },
                style = TextStyle(fontSize = bodySize, fontWeight = FontWeight.Medium, color = ColorProvider(WidgetColors.textSlateLight)),
            )
        }
    }
}

@Composable
private fun DuaPlaceholder() {
    Column(
        modifier = GlanceModifier.fillMaxSize().padding(12.dp),
        horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
        verticalAlignment = Alignment.Vertical.CenterVertically,
    ) {
        Text("🤲", style = TextStyle(fontSize = 22.sp))
        Spacer(modifier = GlanceModifier.height(5.dp))
        Text("Choose a dua", style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ColorProvider(WidgetColors.textWhite)))
        Spacer(modifier = GlanceModifier.height(5.dp))
        Text(
            "Tap the pin on any dua in the app",
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Medium, color = ColorProvider(WidgetColors.textSlate), textAlign = TextAlign.Center),
        )
    }
}
