// NPVR plugin embedding
function embed_vr_plugin(okay_callback, error_callback)
{
	var embed = document.createElement("embed");
	embed.type = "application/x-vnd-vr";
	embed.style.position = "absolute";
	embed.style.left = embed.style.top = embed.style.width = embed.style.height = 0;
	embed.style.visibility = "hidden";

	document.body.appendChild(embed);

	var waitstart = Date.now();

	function waitforplugin()
	{
		var vrplugininterface = window._vr_native_;
		
		if (vrplugininterface && vrplugininterface.poll)
		{
			okay_callback( vrplugininterface );
		}
		else
		{
			if ( Date.now() - waitstart > 2000 )	// after 2sec waiting
			{
				// timeout
				error_callback();
			}
			else
			{
				setTimeout( waitforplugin, 100 );
			}
		}
	}

	waitforplugin();
}

// looking conversion
function rift_quaternion_to_krpano_lookto(x,y,z,w)
{
	var deg = -180.0 / Math.PI;

	var h = deg * Math.atan2(2*(w*y - x*z), 1 - 2*(y*y + z*z));
	var v = deg * Math.atan2(2*(w*x - y*z), 1 - 2*(x*x + z*z));
	var r = deg * Math.asin(2*(x*y + w*z));

	return { h:h, v:v, roll:r };
}

// get rift lookto
function rift_getlookat(vrplugininterface)
{
	var lookat = null;
	var pollData = null;
	
	try
	{
		pollData = vrplugininterface.poll();
	}
	catch(e)
	{
	}
	
	if (pollData)
	{
		var deviceChunks = pollData.split('|');
		for (var n=0; n < deviceChunks.length; n++)
		{
			var deviceChunk = deviceChunks[n].split(',');
			if (deviceChunk.length > 0 && deviceChunk[0] == 'r')
			{
				lookat = rift_quaternion_to_krpano_lookto(parseFloat(deviceChunk[1]), parseFloat(deviceChunk[2]), parseFloat(deviceChunk[3]), parseFloat(deviceChunk[4]));
				break;
			}
		}
	}

	return lookat;
}

// setup
var rift_setup_done = false;

// keyboard control horizontal rotation
var h_rotation_offset = 0.0;
var h_rotation_offset_accel = 0.0;

// viewing
function rift_viewing(vrplugininterface)
{
	var requestFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame;

	function tick()
	{
		requestFrame(tick);

		var krpanoL = ID("krpanoL");
		var krpanoR = ID("krpanoR");

		if (!krpanoL || !krpanoR)
		{
			// viewers not ready
			return;
		}
		
		var rift_state = null;
		
		if ( vrplugininterface.oculState )
		{
			rift_state = vrplugininterface.oculState();
		}
		
		var lookat = rift_getlookat(vrplugininterface);
		if (lookat)
		{
			krpanoL.set("view.hlookat", lookat.h + h_rotation_offset);
			krpanoL.set("view.vlookat", lookat.v);
			krpanoL.set("view.camroll", lookat.roll);

			krpanoR.set("view.hlookat", lookat.h + h_rotation_offset);
			krpanoR.set("view.vlookat", lookat.v);
			krpanoR.set("view.camroll", lookat.roll);
			
			if (rift_setup_done == false && rift_state)
			{
				rift_setup_done = true;
				
				// DK1 lens fov and distortion
				var rift_hsize   = 149.76;
				var rift_ipd     = 63.5;
				var rift_fov     = 100.0;
				var rift_fisheye = 1.0;
				
				if ((""+rift_state).toLowerCase().indexOf("dk2") >= 0)
				{
					// DK2 lens fov and distortion
					rift_hsize   = 126.18;
					rift_ipd     = 0.0;
					rift_fov     = 94.0;
					rift_fisheye = 0.6;
				}
				
				krpanoL.set("rift.hsize", rift_hsize);
				krpanoR.set("rift.hsize", rift_hsize);
				krpanoL.set("rift.ipd", rift_ipd);
				krpanoR.set("rift.ipd", rift_ipd);
				krpanoL.call("setuprift(false);");
				krpanoR.call("setuprift(false);");
				
				krpanoL.set("view.fov", rift_fov);
				krpanoR.set("view.fov", rift_fov);
				krpanoL.set("view.fisheye", rift_fisheye);
				krpanoR.set("view.fisheye", rift_fisheye);
			}
		}
		
		h_rotation_offset += h_rotation_offset_accel;
		h_rotation_offset_accel *= 0.9;
	}

	requestFrame(tick);
}

// keyboard control
function keyboard_callback(keycode)
{
	if(keycode == 37)		// left arrow
	{
		h_rotation_offset_accel -= 0.5;
	}
	else if(keycode == 39)	// right arrow
	{
		h_rotation_offset_accel += 0.5;
	}
}

// sync dynamically changed IPD between viewers
function sync_ipd(ipd)
{
	var krpanoL = ID("krpanoL");
	var krpanoR = ID("krpanoR");

	if (krpanoL && krpanoR)
	{
		krpanoL.set("rift.ipd", ipd);
		krpanoR.set("rift.ipd", ipd);
		krpanoL.call("setuprift(true);");
		krpanoR.call("setuprift(true);");
	}
}

function sync_set(variable, value)
{
	var krpano1 = ID("krpanoL");
	var krpano2 = ID("krpanoR");
	
	krpano1.set(variable, value);
	krpano2.set(variable, value);
}

function sync_call(actions)
{
	var krpano1 = ID("krpanoL");
	var krpano2 = ID("krpanoR");
	
	krpano1.call(actions);
	krpano2.call(actions);
}

// little helper
function ID(id){ return document.getElementById(id); }

// no vr plugin error message
function no_vr_plugin()
{
	var errorBox = ID("errorBox");

	errorBox.innerHTML = ""+
		"<center>"+
		"<br>"+
		"<h1 style='margin-bottom:0;'>NPVR Browser Plugin required!</h1>"+
		"<br>"+
		"Get the plugin here and install it:<br>"+
		"<br>"+
		"<a href='https://github.com/CodingCooky/npvr/#npvr' target='_blank'>https://github.com/CodingCooky/npvr/</a><br>"+
		"<br>"+
		"</center>";

	errorBox.style.display = "";
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}