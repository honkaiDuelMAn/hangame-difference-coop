"""Compare the same non-answer source region in the actual rendered frame."""
import json
import math
import sys
from PIL import Image, ImageChops

image=Image.open(sys.argv[1]).convert('RGB')
data=json.loads(sys.argv[2])
scale=min(data['canvasWidth']/640,data['canvasHeight']/480)
offset_x=(data['canvasWidth']-640*scale)/2
offset_y=(data['canvasHeight']-480*scale)/2
def crop(matrix):
    # Sample equal source offsets in the aligned native surfaces. Never
    # resample either crop, which would hide a glyph-thickness regression.
    x=data.get('pageX',0)+math.floor(matrix['tx']*scale+offset_x+.5)+math.floor(145*scale)
    y=data.get('pageY',0)+math.floor(matrix['ty']*scale+offset_y+.5)+math.floor(210*scale)
    return image.crop((x,y,x+math.floor(45*scale),y+math.floor(17*scale)))
left=crop(data['m1']);right=crop(data['m2'])
diff=ImageChops.difference(left,right)
print(json.dumps({'differentPixels':sum(pixel!=(0,0,0) for pixel in diff.getdata()),'totalPixels':left.width*left.height}))
