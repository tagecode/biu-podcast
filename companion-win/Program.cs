using System.Text.Json;
using Windows.Media;
using Windows.Media.Core;
using Windows.Media.Playback;
using Windows.Storage;
using Windows.Storage.Streams;

// BiuPodcast SMTC companion process.
//
// Bridges the Windows System Media Transport Controls (the volume-flyout /
// media widget) to the Electron main process over stdio:
//   stdin : JSON lines  { "type": "metadata", ... } / { "type": "state", ... }
//   stdout: JSON lines  { "type": "command", "command": "play|pause|next|previous" }
//
// A MediaPlayer carries its own SystemMediaTransportControls session — no
// CoreWindow / ApplicationView is needed, so this works from a headless
// console process. Audio is muted: the player exists only to host the SMTC
// session (the Electron renderer plays the actual audio).

var player = new MediaPlayer
{
    AudioCategory = MediaPlayerAudioCategory.Media,
    IsMuted = true
};

var smtc = player.SystemMediaTransportControls;
smtc.IsEnabled = true;
smtc.IsPlayEnabled = true;
smtc.IsPauseEnabled = true;
smtc.IsNextEnabled = true;
smtc.IsPreviousEnabled = true;
smtc.PlaybackStatus = MediaPlaybackStatus.Paused;

var updater = smtc.DisplayUpdater;
updater.Type = MediaPlaybackType.Music;
updater.MusicProperties.Artist = "";
updater.MusicProperties.Title = "";
updater.MusicProperties.AlbumTitle = "";
updater.Thumbnail = null;
updater.Update();

// Forward SMTC button presses to the parent process.
smtc.ButtonPressed += (_, args) =>
{
    var name = args.Button switch
    {
        SystemMediaTransportControlsButton.Play => "play",
        SystemMediaTransportControlsButton.Pause => "pause",
        SystemMediaTransportControlsButton.Next => "next",
        SystemMediaTransportControlsButton.Previous => "previous",
        _ => null
    };
    if (name != null)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(new { type = "command", command = name }));
        Console.Out.Flush();
    }
};

async Task HandleLineAsync(string line)
{
    try
    {
        using var doc = JsonDocument.Parse(line);
        var root = doc.RootElement;
        var type = root.GetProperty("type").GetString();

        switch (type)
        {
            case "metadata":
            {
                var music = updater.MusicProperties;
                music.Title = root.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
                music.Artist = root.TryGetProperty("artist", out var a) ? a.GetString() ?? "" : "";
                music.AlbumTitle = root.TryGetProperty("album", out var al) ? al.GetString() ?? "" : "";
                var thumb = root.TryGetProperty("artworkUrl", out var url) ? url.GetString() : null;
                if (!string.IsNullOrEmpty(thumb))
                {
                    try
                    {
                        // The thumbnail is a RandomAccessStreamReference (file path
                        // or https URL). HTTPS streaming references work without
                        // downloading; a local file is read on demand.
                        updater.Thumbnail = RandomAccessStreamReference.CreateFromUri(new Uri(thumb));
                    }
                    catch
                    {
                        updater.Thumbnail = null;
                    }
                }
                else
                {
                    updater.Thumbnail = null;
                }
                updater.Update();
                break;
            }
            case "state":
            {
                var playing = root.GetProperty("playing").GetBoolean();
                smtc.PlaybackStatus = playing
                    ? MediaPlaybackStatus.Playing
                    : MediaPlaybackStatus.Paused;
                break;
            }
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[smtc] bad line: {ex.Message}");
    }
}

while (Console.ReadLine() is { } line)
{
    await HandleLineAsync(line);
}
