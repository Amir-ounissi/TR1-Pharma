"use client";
import {useEffect} from "react";
export function ClearInvitationCart({token}:{token:string}){useEffect(()=>{try{window.localStorage.removeItem("tr1-private-cart-"+token);}catch{}},[token]);return null;}
